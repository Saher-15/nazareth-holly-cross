import { describe, expect, it } from 'vitest';
import { PLACE_SLUGS } from '@/data/places/places';
import { buildIcs, escapeIcsText, foldIcsLine, icsLocal, addDays } from '@/data/pilgrim/ics';
import {
  buildItinerary,
  chooseSites,
  DAY_START,
  DEFAULT_PLAN,
  parsePlan,
  planToSearch,
  splitStops,
  STOPS_PER_DAY,
  walkMinutes,
  type PlanInput,
} from '@/data/pilgrim/plan';

const plan = (overrides: Partial<PlanInput> = {}): PlanInput => ({ ...DEFAULT_PLAN, ...overrides });

describe('walking times', () => {
  it('are symmetric, positive and zero only for the same place', () => {
    for (const a of PLACE_SLUGS) {
      for (const b of PLACE_SLUGS) {
        expect(walkMinutes(a, b)).toBe(walkMinutes(b, a));
        expect(walkMinutes(a, b) === 0).toBe(a === b);
      }
    }
  });
});

describe('chooseSites', () => {
  it('keeps as many sites as the days and pace allow, never more than five', () => {
    expect(chooseSites(plan({ days: 1, pace: 'relaxed' }))).toHaveLength(2);
    expect(chooseSites(plan({ days: 1, pace: 'balanced' }))).toHaveLength(3);
    expect(chooseSites(plan({ days: 4, pace: 'full' }))).toHaveLength(5);
  });

  it('puts the sites that match the interests first', () => {
    expect(chooseSites(plan({ days: 1, pace: 'relaxed', interests: ['markets', 'food'] })).sort()).toEqual(['city', 'oldcity']);
    const gospel = chooseSites(plan({ days: 1, pace: 'balanced', interests: ['gospel'] }));
    expect(gospel).toEqual(expect.arrayContaining(['latin', 'greek', 'maryswell']));
  });
});

describe('splitStops', () => {
  it('shares the stops over the days, busiest first', () => {
    expect(splitStops(5, 2)).toEqual([3, 2]);
    expect(splitStops(5, 4)).toEqual([2, 1, 1, 1]);
    expect(splitStops(3, 1)).toEqual([3]);
  });
});

describe('buildItinerary', () => {
  it('visits every chosen site exactly once, in time order, within the stops per day', () => {
    for (const days of [1, 2, 3, 4]) {
      for (const pace of ['relaxed', 'balanced', 'full'] as const) {
        const result = buildItinerary(plan({ days, pace }));
        const visits = result.days.flatMap((d) => d.items.filter((i) => i.kind === 'visit'));
        const slugs = visits.map((v) => (v.kind === 'visit' ? v.slug : ''));
        expect(new Set(slugs).size).toBe(slugs.length);
        expect(slugs).toHaveLength(result.stops);
        expect(result.days.length).toBeLessThanOrEqual(days);
        for (const day of result.days) {
          expect(day.stops).toBeLessThanOrEqual(STOPS_PER_DAY[pace]);
          expect(day.stops).toBeGreaterThan(0);
          let previousEnd = DAY_START;
          for (const item of day.items) {
            expect(item.start).toBeGreaterThanOrEqual(previousEnd);
            expect(item.end).toBeGreaterThan(item.start);
            previousEnd = item.end;
          }
        }
      }
    }
  });

  it('adds up the walking between consecutive stops of a day', () => {
    const result = buildItinerary(plan({ days: 1, pace: 'full' }));
    const [day] = result.days;
    const visits = day.items.flatMap((i) => (i.kind === 'visit' ? [i] : []));
    const expected = visits.slice(1).reduce((sum, v, i) => sum + walkMinutes(visits[i].slug, v.slug), 0);
    expect(day.walkMinutes).toBe(expected);
    expect(visits[0].walkFromPrevious).toBeNull();
    expect(result.walkMinutes).toBe(expected);
  });

  it('takes a lunch break once, after midday, when the day goes on', () => {
    const result = buildItinerary(plan({ days: 1, pace: 'full' }));
    const lunches = result.days[0].items.filter((i) => i.kind === 'lunch');
    expect(lunches).toHaveLength(1);
    expect(lunches[0].start).toBeGreaterThanOrEqual(12 * 60);
    expect(result.days[0].items.at(-1)?.kind).toBe('visit');
  });

  it('never leaves an empty day, even when more days than sites are asked for', () => {
    const result = buildItinerary(plan({ days: 4, pace: 'relaxed', interests: ['food'] }));
    expect(result.days.every((d) => d.stops > 0)).toBe(true);
  });
});

describe('the plan in the URL', () => {
  it('round-trips and leaves the defaults out', () => {
    expect(planToSearch(DEFAULT_PLAN)).toBe('');
    const input = plan({ days: 3, interests: ['gospel', 'food'], pace: 'full', start: '2026-11-02' });
    expect(planToSearch(input)).toBe('days=3&interests=gospel,food&pace=full&start=2026-11-02');
    expect(parsePlan(planToSearch(input))).toEqual(input);
  });

  it('falls back to the defaults for anything invalid', () => {
    expect(parsePlan('days=9&pace=sprint&interests=nope&start=2026-02-31')).toEqual(DEFAULT_PLAN);
    expect(parsePlan('days=abc')).toEqual(DEFAULT_PLAN);
    expect(parsePlan('interests=food,food,gospel').interests).toEqual(['gospel', 'food']);
  });
});

describe('calendar file', () => {
  it('escapes text values', () => {
    expect(escapeIcsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });

  it('folds long lines at 75 octets without splitting a character', () => {
    const line = `DESCRIPTION:${'ש'.repeat(80)}`;
    const folded = foldIcsLine(line).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    for (const [i, part] of folded.entries()) {
      const bytes = new TextEncoder().encode(i === 0 ? part : part.slice(1)).length;
      expect(bytes).toBeLessThanOrEqual(i === 0 ? 75 : 74);
      if (i > 0) expect(part.startsWith(' ')).toBe(true);
    }
    expect(folded.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line);
  });

  it('formats local times and rolls over midnight', () => {
    expect(icsLocal('2026-11-02', 9 * 60 + 30)).toBe('20261102T093000');
    expect(icsLocal('2026-11-02', 24 * 60 + 15)).toBe('20261103T001500');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('builds a valid calendar with CRLF line endings', () => {
    const ics = buildIcs(
      [
        {
          uid: 'latin-1@example.com',
          date: '2026-11-02',
          start: 540,
          end: 615,
          summary: 'Church, of the Annunciation',
          location: 'Nazareth, Israel',
          geo: { lat: 32.70222, lng: 35.2975 },
        },
      ],
      { name: 'Pilgrimage', now: new Date(Date.UTC(2026, 9, 5, 12, 0, 0)) },
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTAMP:20261005T120000Z');
    expect(ics).toContain('DTSTART:20261102T090000');
    expect(ics).toContain('DTEND:20261102T101500');
    expect(ics).toContain('SUMMARY:Church\\, of the Annunciation');
    expect(ics).toContain('GEO:32.702220;35.297500');
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
});
