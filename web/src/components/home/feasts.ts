// The feast of the day, or the next major Christian feast, for the home page's "Today in Nazareth" strip.
//
// A deliberately small stand-in, kept in this one file: the full liturgical calendar (branch feat/christian-calendar,
// pull request #46, `web/src/lib/liturgical/`) replaces it. When that is on main, this file becomes a thin adapter:
//   const [next] = nextFeasts(date, 1, 'all');           // from '@/lib/liturgical'
//   return { key: next.id, date: next.date, today: next.date === date, days: <whole days from date to next.date> };
// and TodayInNazareth names it with pilgrim.calendar.feasts.<id>.name (.orthodoxName when only the Orthodox keep it
// that day); then delete home.today.feasts.* from the 14 message files and the computus below.
//
// What it knows: the great feasts of the Western (Latin) calendar, with Easter computed (Gregorian computus) and the
// Annunciation moved as the Roman rite moves it when 25 March falls on a Sunday of Lent, in Holy Week or in the Easter
// octave; and, because Nazareth's Greek Orthodox church keeps the Julian calendar (Patriarchate of Jerusalem), the
// Orthodox Christmas (7 January), Annunciation (7 April) and Easter (Julian computus). The Julian dates are converted
// with the 13-day difference that holds from 1900 to 2099. Dates are calendar days in Nazareth ("YYYY-MM-DD").

export const FEAST_KEYS = [
  'epiphany',
  'orthodoxChristmas',
  'annunciation',
  'orthodoxAnnunciation',
  'palmSunday',
  'goodFriday',
  'easter',
  'orthodoxEaster',
  'ascension',
  'pentecost',
  'assumption',
  'holyCross',
  'christmas',
] as const;
export type FeastKey = (typeof FEAST_KEYS)[number];

export type FeastDay = { key: FeastKey; date: string };

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (utcMs: number) => {
  const d = new Date(utcMs);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const utc = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day);
const parse = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return utc(y, m, d);
};

/** Western Easter Sunday (the anonymous Gregorian algorithm, Meeus), as a UTC midnight in milliseconds. */
export function westernEaster(year: number): number {
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
  return utc(year, month, day);
}

/** Orthodox Easter Sunday (the Julian computus, Meeus), in the Gregorian calendar, as a UTC midnight in milliseconds. */
export function orthodoxEaster(year: number): number {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return utc(year, month, day) + 13 * DAY_MS; // Julian to Gregorian, 1900-2099
}

/** The Annunciation in the Roman rite: 25 March, unless that day is a Sunday of Lent or in Holy Week / the Easter octave. */
function annunciation(year: number, easter: number): number {
  const day = utc(year, 3, 25);
  if (day >= easter - 7 * DAY_MS && day <= easter + 7 * DAY_MS) return easter + 8 * DAY_MS; // Monday after the octave
  if (new Date(day).getUTCDay() === 0) return day + DAY_MS; // a Sunday of Lent: the Monday
  return day;
}

/** The feasts of one calendar year, in date order. Orthodox Easter is left out when it falls with the Western one. */
export function feastsOfYear(year: number): FeastDay[] {
  const easter = westernEaster(year);
  const eastern = orthodoxEaster(year);
  const days: [FeastKey, number][] = [
    ['epiphany', utc(year, 1, 6)],
    ['orthodoxChristmas', utc(year, 1, 7)],
    ['annunciation', annunciation(year, easter)],
    ['orthodoxAnnunciation', utc(year, 4, 7)],
    ['palmSunday', easter - 7 * DAY_MS],
    ['goodFriday', easter - 2 * DAY_MS],
    ['easter', easter],
    ['ascension', easter + 39 * DAY_MS],
    ['pentecost', easter + 49 * DAY_MS],
    ['assumption', utc(year, 8, 15)],
    ['holyCross', utc(year, 9, 14)],
    ['christmas', utc(year, 12, 25)],
  ];
  if (eastern !== easter) days.push(['orthodoxEaster', eastern]);
  return days
    .sort((x, y) => x[1] - y[1] || FEAST_KEYS.indexOf(x[0]) - FEAST_KEYS.indexOf(y[0]))
    .map(([key, ms]) => ({ key, date: iso(ms) }));
}

export type FeastOnDay = FeastDay & {
  /** True when the feast is on the given day itself. */
  today: boolean;
  /** Whole days from the given day to the feast (0 today). */
  days: number;
};

/** The feast on `date` ("YYYY-MM-DD", Nazareth), or else the next one. */
export function feastOn(date: string): FeastOnDay {
  const year = Number(date.slice(0, 4));
  const from = parse(date);
  const next = [...feastsOfYear(year), ...feastsOfYear(year + 1)].find((f) => parse(f.date) >= from)!;
  const days = Math.round((parse(next.date) - from) / DAY_MS);
  return { ...next, today: days === 0, days };
}
