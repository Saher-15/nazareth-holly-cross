import { julianToGregorian, toIsoDate, type CivilDate, type IsoDate } from './civil';

// The date of Easter in both traditions, computed (never typed in per year). Docs: docs/LITURGICAL-CALENDAR.md.
//
//  - Western (Catholic, Protestant): the Gregorian computus, as the "Anonymous Gregorian algorithm" (Meeus, Jones,
//    Butcher). Valid for every Gregorian year from 1583.
//  - Orthodox: the Julian computus (Meeus's Julian algorithm) gives a date of the Julian calendar, which is then
//    written in the Gregorian calendar through the Julian Day Number (13 days later from 1900 to 2099, 14 from 2100).

export const MIN_YEAR = 1583;
export const MAX_YEAR = 9999;

function checkYear(year: number) {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`Easter is computed for the years ${MIN_YEAR}-${MAX_YEAR}, not ${year}`);
  }
}

/** Western Easter Sunday (Gregorian calendar). */
export function westernEaster(year: number): IsoDate {
  checkYear(year);
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIsoDate({ year, month, day });
}

/** Orthodox Easter (Pascha) as a date of the Julian calendar. */
export function orthodoxEasterJulian(year: number): CivilDate {
  checkYear(year);
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return { year, month, day };
}

/** Orthodox Easter (Pascha) written in the Gregorian calendar, the calendar the site shows. */
export function orthodoxEaster(year: number): IsoDate {
  return julianToGregorian(orthodoxEasterJulian(year));
}
