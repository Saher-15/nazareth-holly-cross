import { NAZARETH_TIME_ZONE } from '../time';
import { civilDateIn, isIsoDate, parseIsoDate, type IsoDate } from './civil';
import { feastsOfYear, matchesTradition, type FeastOccurrence, type TraditionFilter } from './feasts';

// The Christian (liturgical) calendar of the site, Catholic and Orthodox: pure date logic, no React, no messages.
// The /live page shows it (components/calendar/); any other page can ask for the next feasts:
//
//   import { nextFeasts } from '@/lib/liturgical';
//   nextFeasts(new Date(), 3, 'all')  ->  the next three feasts from today in Nazareth, both traditions
//
// Names and descriptions are messages: pilgrim.calendar.feasts.<id>.name / .description (/.orthodoxName when the
// occurrence is Orthodox only and the feast has one). Docs: docs/LITURGICAL-CALENDAR.md.

export * from './civil';
export * from './easter';
export * from './feasts';

/** Today's date in Nazareth (the site's dates are Nazareth's, wherever the visitor is). */
export function nazarethToday(now: Date | number = Date.now()): IsoDate {
  return civilDateIn(now, NAZARETH_TIME_ZONE);
}

/** A Date (an instant: its day in Nazareth) or a calendar date 'YYYY-MM-DD', as a calendar date. */
function toDay(date: Date | IsoDate): IsoDate {
  if (typeof date === 'string') {
    if (!isIsoDate(date)) throw new RangeError(`not a calendar date: ${date}`);
    return date;
  }
  return nazarethToday(date);
}

/** Feasts from `from` to `to` (both included), in date order. */
export function feastsBetween(from: IsoDate, to: IsoDate, tradition: TraditionFilter = 'all'): FeastOccurrence[] {
  if (to < from) return [];
  const first = parseIsoDate(from).year;
  const last = parseIsoDate(to).year;
  const out: FeastOccurrence[] = [];
  for (let year = first; year <= last; year += 1) {
    for (const occurrence of feastsOfYear(year)) {
      if (occurrence.date >= from && occurrence.date <= to && matchesTradition(occurrence, tradition)) out.push(occurrence);
    }
  }
  return out;
}

/** The feasts of one calendar day. */
export function feastsOn(date: IsoDate, tradition: TraditionFilter = 'all'): FeastOccurrence[] {
  return feastsBetween(date, date, tradition);
}

/**
 * The next `n` feasts from `date` on (a feast on that day counts), in date order. `date` is an instant (its day in
 * Nazareth is used) or a calendar date 'YYYY-MM-DD'. `tradition` keeps the feasts of one tradition ('catholic',
 * 'orthodox'); a feast both celebrate on the same day matches either. At most 100.
 */
export function nextFeasts(date: Date | IsoDate, n: number, tradition: TraditionFilter = 'all'): FeastOccurrence[] {
  const from = toDay(date);
  const wanted = Math.max(0, Math.min(100, Math.floor(n)));
  const out: FeastOccurrence[] = [];
  // Every year has more than 20 feasts in each tradition, so a few years always fill the list.
  for (let year = parseIsoDate(from).year; out.length < wanted && year <= parseIsoDate(from).year + 6; year += 1) {
    for (const occurrence of feastsOfYear(year)) {
      if (occurrence.date >= from && matchesTradition(occurrence, tradition)) out.push(occurrence);
      if (out.length >= wanted) break;
    }
  }
  return out;
}
