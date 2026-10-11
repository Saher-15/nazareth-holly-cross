import { addDays, julianToGregorian, parseIsoDate, toIsoDate, weekday, type IsoDate } from './civil';
import { orthodoxEaster, westernEaster } from './easter';

// The feasts of the calendar and the rule that dates each of them, per tradition. Nothing here is a date typed in for
// a given year: every date is computed from Easter of that tradition or from a fixed day of that tradition's calendar.
// Docs (sources, conventions, how to add a feast): docs/LITURGICAL-CALENDAR.md.
//
// Conventions:
//  - "catholic" is the Roman (Latin) calendar: fixed feasts on the Gregorian calendar, Gregorian Easter, and the
//    Roman Rite's transfer rules for the three solemnities that can collide with a privileged Sunday or Holy Week.
//  - "orthodox" is the calendar of the Greek Orthodox Patriarchate of Jerusalem (and of Russia, Serbia, Georgia ...):
//    fixed feasts on the Julian calendar (13 days later on our calendar until 2099), Julian Easter.

export const TRADITIONS = ['catholic', 'orthodox'] as const;
export type Tradition = (typeof TRADITIONS)[number];
export type TraditionFilter = Tradition | 'all';
export const TRADITION_FILTERS: readonly TraditionFilter[] = ['all', 'catholic', 'orthodox'];

type Rule =
  /** Days after Easter of the same tradition (negative: before). */
  | { type: 'easter'; offset: number }
  /** A fixed day of the tradition's own calendar: Gregorian for catholic, Julian for orthodox. */
  | { type: 'fixed'; month: number; day: number }
  /** The n-th Sunday of Advent (Roman calendar). */
  | { type: 'advent'; sunday: 1 | 2 | 3 | 4 };

/** Roman Rite rules that move a solemnity away from a Sunday of Lent or Advent, Holy Week or the Easter Octave. */
type Transfer = 'stJoseph' | 'annunciation' | 'immaculateConception';

export type FeastDefinition = {
  id: string;
  catholic?: Rule;
  orthodox?: Rule;
  /** One of Nazareth's own feasts (shown with a mark of its own): the Annunciation and the Holy Cross. */
  nazareth?: boolean;
  /** The Orthodox Church calls the feast by another name (messages: pilgrim.calendar.feasts.<id>.orthodoxName). */
  orthodoxName?: boolean;
  transfer?: Transfer;
};

const easter = (offset: number): Rule => ({ type: 'easter', offset });
const fixed = (month: number, day: number): Rule => ({ type: 'fixed', month, day });

// In the order of the liturgical year. The order also decides which of two feasts on the same day comes first.
export const FEASTS = [
  { id: 'maryMotherOfGod', catholic: fixed(1, 1) },
  { id: 'epiphany', catholic: fixed(1, 6), orthodox: fixed(1, 6), orthodoxName: true },
  { id: 'presentation', catholic: fixed(2, 2), orthodox: fixed(2, 2), orthodoxName: true },
  { id: 'cleanMonday', orthodox: easter(-48) },
  { id: 'ashWednesday', catholic: easter(-46) },
  { id: 'stJoseph', catholic: fixed(3, 19), transfer: 'stJoseph' },
  { id: 'annunciation', catholic: fixed(3, 25), orthodox: fixed(3, 25), nazareth: true, orthodoxName: true, transfer: 'annunciation' },
  { id: 'palmSunday', catholic: easter(-7), orthodox: easter(-7), orthodoxName: true },
  { id: 'holyThursday', catholic: easter(-3), orthodox: easter(-3), orthodoxName: true },
  { id: 'goodFriday', catholic: easter(-2), orthodox: easter(-2), orthodoxName: true },
  { id: 'holySaturday', catholic: easter(-1), orthodox: easter(-1), orthodoxName: true },
  { id: 'easter', catholic: easter(0), orthodox: easter(0), orthodoxName: true },
  { id: 'divineMercy', catholic: easter(7) },
  { id: 'ascension', catholic: easter(39), orthodox: easter(39) },
  { id: 'pentecost', catholic: easter(49), orthodox: easter(49), orthodoxName: true },
  { id: 'trinity', catholic: easter(56) },
  { id: 'corpusChristi', catholic: easter(60) },
  { id: 'transfiguration', catholic: fixed(8, 6), orthodox: fixed(8, 6) },
  { id: 'assumption', catholic: fixed(8, 15), orthodox: fixed(8, 15), orthodoxName: true },
  { id: 'nativityOfMary', catholic: fixed(9, 8), orthodox: fixed(9, 8), orthodoxName: true },
  { id: 'holyCross', catholic: fixed(9, 14), orthodox: fixed(9, 14), nazareth: true, orthodoxName: true },
  // All Saints: 1 November in the West; the Sunday after Pentecost in the East.
  { id: 'allSaints', catholic: fixed(11, 1), orthodox: easter(56), orthodoxName: true },
  { id: 'advent1', catholic: { type: 'advent', sunday: 1 } },
  { id: 'advent2', catholic: { type: 'advent', sunday: 2 } },
  { id: 'advent3', catholic: { type: 'advent', sunday: 3 } },
  { id: 'advent4', catholic: { type: 'advent', sunday: 4 } },
  { id: 'immaculateConception', catholic: fixed(12, 8), transfer: 'immaculateConception' },
  { id: 'christmas', catholic: fixed(12, 25), orthodox: fixed(12, 25), orthodoxName: true },
] as const satisfies readonly FeastDefinition[];

export type FeastId = (typeof FEASTS)[number]['id'];
export const FEAST_IDS: readonly FeastId[] = FEASTS.map((f) => f.id);

const definitions = new Map<string, FeastDefinition>(FEASTS.map((f) => [f.id, f]));
export const feastDefinition = (id: FeastId): FeastDefinition => definitions.get(id)!;

export type FeastOccurrence = {
  id: FeastId;
  /** The day it is celebrated, on the Gregorian calendar. */
  date: IsoDate;
  /** Who celebrates it on that day: one tradition, or both when their dates meet (Easter in some years). */
  traditions: readonly Tradition[];
  /** One of Nazareth's own feasts. */
  nazareth: boolean;
  /** A Roman solemnity moved by the transfer rules: the day it would otherwise have fallen on. */
  transferredFrom?: IsoDate;
  /** An Orthodox fixed feast: its day and month on the Julian calendar. */
  julian?: { month: number; day: number };
};

// ---- Roman Rite: Advent and the transfer rules ----

/** The n-th Sunday of Advent: the fourth is the last Sunday before Christmas (18-24 December). */
export function adventSunday(year: number, n: 1 | 2 | 3 | 4): IsoDate {
  const christmas = toIsoDate({ year, month: 12, day: 25 });
  const back = weekday(christmas) === 0 ? 7 : weekday(christmas);
  return addDays(christmas, -back - 7 * (4 - n));
}

const between = (date: IsoDate, from: IsoDate, to: IsoDate) => date >= from && date <= to;

/**
 * Where a Roman solemnity is celebrated in `year` (Universal Norms on the Liturgical Year 5 and 60; the
 * Congregation for Divine Worship's notification of 22 April 2008 for St Joseph and the Annunciation):
 *  - St Joseph in Holy Week: the Saturday before Palm Sunday; on a Sunday of Lent: the Monday after.
 *  - The Annunciation from Palm Sunday to the Second Sunday of Easter: the Monday after that Sunday; on a Sunday of
 *    Lent: the Monday after.
 *  - The Immaculate Conception on a Sunday (always a Sunday of Advent): Monday 9 December.
 */
export function transferredDate(rule: Transfer, date: IsoDate): IsoDate {
  const { year } = parseIsoDate(date);
  const easterDay = westernEaster(year);
  const palmSunday = addDays(easterDay, -7);
  const ashWednesday = addDays(easterDay, -46);
  const sunday = weekday(date) === 0;
  const sundayOfLent = sunday && between(date, ashWednesday, addDays(palmSunday, -1));
  switch (rule) {
    case 'stJoseph':
      if (between(date, palmSunday, addDays(easterDay, -1))) return addDays(palmSunday, -1);
      return sundayOfLent ? addDays(date, 1) : date;
    case 'annunciation':
      if (between(date, palmSunday, addDays(easterDay, 7))) return addDays(easterDay, 8);
      return sundayOfLent ? addDays(date, 1) : date;
    case 'immaculateConception':
      return sunday ? addDays(date, 1) : date;
  }
}

// ---- Occurrences ----

function catholicDates(feast: FeastDefinition, year: number): FeastOccurrence[] {
  const rule = feast.catholic;
  if (!rule) return [];
  const base = { id: feast.id as FeastId, traditions: ['catholic'] as const, nazareth: Boolean(feast.nazareth) };
  if (rule.type === 'easter') return [{ ...base, date: addDays(westernEaster(year), rule.offset) }];
  if (rule.type === 'advent') return [{ ...base, date: adventSunday(year, rule.sunday) }];
  const nominal = toIsoDate({ year, month: rule.month, day: rule.day });
  const date = feast.transfer ? transferredDate(feast.transfer, nominal) : nominal;
  return [{ ...base, date, ...(date !== nominal ? { transferredFrom: nominal } : {}) }];
}

function orthodoxDates(feast: FeastDefinition, year: number): FeastOccurrence[] {
  const rule = feast.orthodox;
  if (!rule) return [];
  const base = { id: feast.id as FeastId, traditions: ['orthodox'] as const, nazareth: Boolean(feast.nazareth) };
  if (rule.type === 'easter') return [{ ...base, date: addDays(orthodoxEaster(year), rule.offset) }];
  if (rule.type !== 'fixed') return [];
  // A Julian date of year J falls in Gregorian year J or J + 1 (25 December Julian is 7 January): look at both
  // Julian years that can land in `year` and keep what does.
  return [year - 1, year]
    .map((julianYear) => julianToGregorian({ year: julianYear, month: rule.month, day: rule.day }))
    .filter((date) => parseIsoDate(date).year === year)
    .map((date) => ({ ...base, date, julian: { month: rule.month, day: rule.day } }));
}

const order = new Map<string, number>(FEASTS.map((f, i) => [f.id, i]));

/** Same day: Nazareth's own feasts first, then the order of the liturgical year. */
export function compareOccurrences(a: FeastOccurrence, b: FeastOccurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.nazareth !== b.nazareth) return a.nazareth ? -1 : 1;
  const byFeast = (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  if (byFeast) return byFeast;
  return a.traditions.length === b.traditions.length ? (a.traditions[0] < b.traditions[0] ? -1 : 1) : b.traditions.length - a.traditions.length;
}

const yearCache = new Map<number, readonly FeastOccurrence[]>();

/**
 * Every feast celebrated in the Gregorian year `year`, in date order. When the Catholic and the Orthodox date of a
 * feast are the same day (Easter in 2025, 2028, 2031, 2034 ...), the two become one occurrence of both traditions.
 */
export function feastsOfYear(year: number): readonly FeastOccurrence[] {
  const cached = yearCache.get(year);
  if (cached) return cached;
  const merged = new Map<string, FeastOccurrence>();
  for (const feast of FEASTS) {
    for (const occurrence of [...catholicDates(feast, year), ...orthodoxDates(feast, year)]) {
      const key = `${occurrence.id}|${occurrence.date}`;
      const same = merged.get(key);
      merged.set(
        key,
        same
          ? { ...same, ...occurrence, traditions: TRADITIONS.filter((t) => same.traditions.includes(t) || occurrence.traditions.includes(t)) }
          : occurrence,
      );
    }
  }
  const list = Object.freeze([...merged.values()].sort(compareOccurrences));
  if (yearCache.size > 64) yearCache.clear();
  yearCache.set(year, list);
  return list;
}

/** True when only the Orthodox keep the occurrence that day and the feast has an Orthodox name of its own. */
export function usesOrthodoxName(occurrence: FeastOccurrence): boolean {
  return occurrence.traditions.length === 1 && occurrence.traditions[0] === 'orthodox' && Boolean(feastDefinition(occurrence.id).orthodoxName);
}

export function matchesTradition(occurrence: FeastOccurrence, filter: TraditionFilter): boolean {
  return filter === 'all' || occurrence.traditions.includes(filter);
}
