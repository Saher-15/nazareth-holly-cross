import { PLACE_SLUGS, type PlaceSlug } from '@/data/places/places';

// Pure rules of the pilgrimage planner (/plan): which sites to visit, in which order, on which day, at what
// time, and how that is written in the URL. No React here so it can be unit tested.

export const INTERESTS = ['gospel', 'churches', 'markets', 'food'] as const;
export type Interest = (typeof INTERESTS)[number];

export const PACES = ['relaxed', 'balanced', 'full'] as const;
export type Pace = (typeof PACES)[number];

export const MIN_DAYS = 1;
export const MAX_DAYS = 4;

export type PlanInput = { days: number; interests: readonly Interest[]; pace: Pace; start: string };

export const DEFAULT_PLAN: PlanInput = { days: 2, interests: [], pace: 'balanced', start: '' };

/** What each holy site offers, and how long a visit takes at a balanced pace (minutes). */
export const SITE_INFO: Record<PlaceSlug, { minutes: number; interests: readonly Interest[] }> = {
  latin: { minutes: 75, interests: ['gospel', 'churches'] },
  greek: { minutes: 45, interests: ['gospel', 'churches'] },
  maryswell: { minutes: 30, interests: ['gospel'] },
  oldcity: { minutes: 90, interests: ['gospel', 'churches', 'markets', 'food'] },
  city: { minutes: 60, interests: ['markets', 'food'] },
};

/** Stops per day for each pace. */
export const STOPS_PER_DAY: Record<Pace, number> = { relaxed: 2, balanced: 3, full: 4 };

/** A relaxed day lingers longer at each stop; balanced and full days differ in how many stops they hold. */
const PACE_FACTOR: Record<Pace, number> = { relaxed: 1.25, balanced: 1, full: 1 };

// Approximate minutes on foot between the sites (streets of Nazareth are steep in places), both directions.
// Estimated from the map coordinates in data/places plus a street factor; they are guidance, not a promise.
const WALK_TABLE: Record<PlaceSlug, Partial<Record<PlaceSlug, number>>> = {
  latin: { greek: 12, maryswell: 10, oldcity: 4, city: 3 },
  greek: { maryswell: 3, oldcity: 12, city: 14 },
  maryswell: { oldcity: 10, city: 12 },
  oldcity: { city: 6 },
  city: {},
};

export function walkMinutes(a: PlaceSlug, b: PlaceSlug): number {
  if (a === b) return 0;
  return WALK_TABLE[a][b] ?? WALK_TABLE[b][a] ?? 15;
}

export const DAY_START = 9 * 60; // 09:00
const LUNCH_FROM = 12 * 60;
export const LUNCH_MINUTES = 60;
const ROUND = 5;
const round = (minutes: number) => Math.round(minutes / ROUND) * ROUND;

export type VisitItem = {
  kind: 'visit';
  slug: PlaceSlug;
  /** Minutes after midnight. */
  start: number;
  end: number;
  /** Walk from the previous stop of the day; null for the first. */
  walkFromPrevious: number | null;
};
export type LunchItem = { kind: 'lunch'; start: number; end: number };
export type DayItem = VisitItem | LunchItem;
export type Day = { number: number; items: DayItem[]; stops: number; walkMinutes: number; endsAt: number };
export type Itinerary = { days: Day[]; stops: number; walkMinutes: number };

/** How many of an interest list a site matches (no interests chosen = every site matches equally). */
function score(slug: PlaceSlug, interests: readonly Interest[]): number {
  return SITE_INFO[slug].interests.filter((i) => interests.includes(i)).length;
}

/** Every ordering of the items (at most 5 here, so 120 orderings). */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

/** The order that needs the least walking to see all the given sites once. */
function shortestRoute(slugs: readonly PlaceSlug[]): PlaceSlug[] {
  let best: PlaceSlug[] = slugs.slice();
  let bestCost = Infinity;
  for (const order of permutations(slugs)) {
    const cost = order.reduce((sum, slug, i) => (i === 0 ? 0 : sum + walkMinutes(order[i - 1], slug)), 0);
    // On a tie keep the order that starts with the site that comes first in the usual list.
    if (cost < bestCost) {
      best = order;
      bestCost = cost;
    }
  }
  return best;
}

/** Which sites are in the plan: the best matches for the interests, as many as the days and pace allow. */
export function chooseSites(input: Pick<PlanInput, 'days' | 'interests' | 'pace'>): PlaceSlug[] {
  const capacity = input.days * STOPS_PER_DAY[input.pace];
  return PLACE_SLUGS.map((slug, order) => ({ slug, order, score: score(slug, input.interests) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, Math.min(PLACE_SLUGS.length, capacity))
    .map((s) => s.slug);
}

/** Splits `count` stops over `days` days as evenly as possible, the busier days first. */
export function splitStops(count: number, days: number): number[] {
  const base = Math.floor(count / days);
  const extra = count % days;
  return Array.from({ length: days }, (_, i) => base + (i < extra ? 1 : 0));
}

export function buildItinerary(input: PlanInput): Itinerary {
  const sites = shortestRoute(chooseSites(input));
  const days = Math.min(clampDays(input.days), sites.length);
  const sizes = splitStops(sites.length, days);

  let cursor = 0;
  const result: Day[] = sizes.map((size, index) => {
    const slugs = sites.slice(cursor, cursor + size);
    cursor += size;

    const items: DayItem[] = [];
    let time = DAY_START;
    let lunchTaken = false;
    let walked = 0;

    slugs.forEach((slug, i) => {
      const walk = i === 0 ? null : walkMinutes(slugs[i - 1], slug);
      if (walk !== null) {
        time += walk;
        walked += walk;
      }
      const start = round(time);
      const end = round(start + SITE_INFO[slug].minutes * PACE_FACTOR[input.pace]);
      items.push({ kind: 'visit', slug, start, end, walkFromPrevious: walk });
      time = end;

      // A lunch break after the first stop that ends past midday, when the day goes on afterwards.
      if (!lunchTaken && time >= LUNCH_FROM && i < slugs.length - 1) {
        items.push({ kind: 'lunch', start: time, end: time + LUNCH_MINUTES });
        time += LUNCH_MINUTES;
        lunchTaken = true;
      }
    });

    return { number: index + 1, items, stops: slugs.length, walkMinutes: walked, endsAt: time };
  });

  return {
    days: result,
    stops: result.reduce((n, d) => n + d.stops, 0),
    walkMinutes: result.reduce((n, d) => n + d.walkMinutes, 0),
  };
}

export const clampDays = (days: number) => Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(days) || DEFAULT_PLAN.days));

// ---- the plan in the URL (?days=2&interests=gospel,food&pace=full&start=2026-11-02) ----

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Reads a plan from a query string; anything missing or invalid falls back to the default. */
export function parsePlan(search: string): PlanInput {
  const params = new URLSearchParams(search);
  const days = Number(params.get('days'));
  const pace = params.get('pace');
  const start = params.get('start') ?? '';
  const interests = (params.get('interests') ?? '')
    .split(',')
    .filter((value): value is Interest => (INTERESTS as readonly string[]).includes(value));
  return {
    days: Number.isInteger(days) && days >= MIN_DAYS && days <= MAX_DAYS ? days : DEFAULT_PLAN.days,
    interests: INTERESTS.filter((i) => interests.includes(i)),
    pace: (PACES as readonly string[]).includes(pace ?? '') ? (pace as Pace) : DEFAULT_PLAN.pace,
    start: isIsoDate(start) ? start : '',
  };
}

/** The query string (without "?") of a plan; defaults are left out so the URL stays short. */
export function planToSearch(input: PlanInput): string {
  const params = new URLSearchParams();
  if (input.days !== DEFAULT_PLAN.days) params.set('days', String(input.days));
  if (input.interests.length) params.set('interests', input.interests.join(','));
  if (input.pace !== DEFAULT_PLAN.pace) params.set('pace', input.pace);
  if (input.start) params.set('start', input.start);
  return params.toString().replace(/%2C/g, ',');
}

/** Minutes after midnight as a Date whose UTC clock shows that time (format it with timeZone: 'UTC'). */
export const clockDate = (minutes: number) => new Date(Date.UTC(2000, 0, 1, 0, minutes));
