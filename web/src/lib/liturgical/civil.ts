// Civil (calendar) dates without a time of day, written as ISO strings: '2026-03-25'.
//
// A feast belongs to a day, not to an instant, so the calendar never stores a Date for it: a Date is an instant and
// would show a different day in another time zone. Arithmetic is done on day numbers (days since 1970-01-01, through
// Date.UTC), which no time zone and no daylight-saving change can shift. The only place a time zone enters is
// `civilDateIn`: "which day is it in Nazareth at this instant?". Docs: docs/LITURGICAL-CALENDAR.md.

/** A calendar date, 'YYYY-MM-DD' (Gregorian). */
export type IsoDate = string;
export type CivilDate = { year: number; month: number; day: number };

const DAY_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Whether the value is a real Gregorian date written as 'YYYY-MM-DD' (2026-02-30 is not). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const m = ISO.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseIsoDate(iso: IsoDate): CivilDate {
  if (!isIsoDate(iso)) throw new RangeError(`not a calendar date: ${String(iso)}`);
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

export function toIsoDate({ year, month, day }: CivilDate): IsoDate {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** Days since 1970-01-01 (negative before). */
export function dayNumber(iso: IsoDate): number {
  const { year, month, day } = parseIsoDate(iso);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function fromDayNumber(n: number): IsoDate {
  const at = new Date(n * DAY_MS);
  return toIsoDate({ year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() });
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromDayNumber(dayNumber(iso) + days);
}

/** `b` minus `a` in days. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return dayNumber(b) - dayNumber(a);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(iso: IsoDate): number {
  // 1970-01-01 was a Thursday (4).
  return (((dayNumber(iso) + 4) % 7) + 7) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The same day of the month `months` later (or earlier), clamped to the length of that month (31 Jan + 1 = 28/29 Feb). */
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const { year, month, day } = parseIsoDate(iso);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return toIsoDate({ year: y, month: m, day: Math.min(day, daysInMonth(y, m)) });
}

/** The instant at noon UTC of a calendar date: formatted with `timeZone: 'UTC'` it always shows that same day. */
export function noonUtc(iso: IsoDate): Date {
  const { year, month, day } = parseIsoDate(iso);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/** The calendar date at `instant` in `timeZone` (an IANA name such as 'Asia/Jerusalem'). */
export function civilDateIn(instant: Date | number, timeZone: string): IsoDate {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', calendar: 'gregory', numberingSystem: 'latn' }).formatToParts(
    typeof instant === 'number' ? new Date(instant) : instant,
  );
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return toIsoDate({ year: part('year'), month: part('month'), day: part('day') });
}

// ---- Julian Day Numbers: the bridge between the Julian and the Gregorian calendars ----
// (Fliegel and Van Flandern's integer formulas; valid for every date after 4713 BC.)

const prepare = (year: number, month: number) => {
  const a = Math.floor((14 - month) / 12);
  return { y: year + 4800 - a, m: month + 12 * a - 3 };
};

export function gregorianToJdn({ year, month, day }: CivilDate): number {
  const { y, m } = prepare(year, month);
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function julianToJdn({ year, month, day }: CivilDate): number {
  const { y, m } = prepare(year, month);
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

export function jdnToGregorian(jdn: number): CivilDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

export function jdnToJulian(jdn: number): CivilDate {
  const c = jdn + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: d - 4800 + Math.floor(m / 10),
  };
}

/** A date of the Julian calendar, written in the Gregorian calendar (25 March 2026 Julian = 2026-04-07). */
export function julianToGregorian(date: CivilDate): IsoDate {
  return toIsoDate(jdnToGregorian(julianToJdn(date)));
}

/** The Julian-calendar date of a Gregorian date. */
export function gregorianToJulian(iso: IsoDate): CivilDate {
  return jdnToJulian(gregorianToJdn(parseIsoDate(iso)));
}
