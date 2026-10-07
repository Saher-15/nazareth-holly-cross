import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  adventSunday,
  civilDateIn,
  dayNumber,
  daysBetween,
  feastsBetween,
  feastsOfYear,
  feastsOn,
  FEASTS,
  fromDayNumber,
  gregorianToJulian,
  isIsoDate,
  julianToGregorian,
  nazarethToday,
  nextFeasts,
  orthodoxEaster,
  orthodoxEasterJulian,
  transferredDate,
  weekday,
  westernEaster,
  type FeastId,
  type FeastOccurrence,
  type Tradition,
} from '@/lib/liturgical';

// The Christian calendar's date logic (web/src/lib/liturgical, docs/LITURGICAL-CALENDAR.md). The Easter tables are
// copied from published tables (sources in the docs), not produced by the code under test.

// Western (Gregorian) Easter Sunday, 2000-2040.
const WESTERN: Record<number, string> = {
  2000: '04-23', 2001: '04-15', 2002: '03-31', 2003: '04-20', 2004: '04-11', 2005: '03-27', 2006: '04-16', 2007: '04-08',
  2008: '03-23', 2009: '04-12', 2010: '04-04', 2011: '04-24', 2012: '04-08', 2013: '03-31', 2014: '04-20', 2015: '04-05',
  2016: '03-27', 2017: '04-16', 2018: '04-01', 2019: '04-21', 2020: '04-12', 2021: '04-04', 2022: '04-17', 2023: '04-09',
  2024: '03-31', 2025: '04-20', 2026: '04-05', 2027: '03-28', 2028: '04-16', 2029: '04-01', 2030: '04-21', 2031: '04-13',
  2032: '03-28', 2033: '04-17', 2034: '04-09', 2035: '03-25', 2036: '04-13', 2037: '04-05', 2038: '04-25', 2039: '04-10',
  2040: '04-01',
};

// Orthodox Easter (Pascha), written in the Gregorian calendar, 2000-2040.
const ORTHODOX: Record<number, string> = {
  2000: '04-30', 2001: '04-15', 2002: '05-05', 2003: '04-27', 2004: '04-11', 2005: '05-01', 2006: '04-23', 2007: '04-08',
  2008: '04-27', 2009: '04-19', 2010: '04-04', 2011: '04-24', 2012: '04-15', 2013: '05-05', 2014: '04-20', 2015: '04-12',
  2016: '05-01', 2017: '04-16', 2018: '04-08', 2019: '04-28', 2020: '04-19', 2021: '05-02', 2022: '04-24', 2023: '04-16',
  2024: '05-05', 2025: '04-20', 2026: '04-12', 2027: '05-02', 2028: '04-16', 2029: '04-08', 2030: '04-28', 2031: '04-13',
  2032: '05-02', 2033: '04-24', 2034: '04-09', 2035: '04-29', 2036: '04-20', 2037: '04-05', 2038: '04-25', 2039: '04-17',
  2040: '05-06',
};

const YEARS = Object.keys(WESTERN).map(Number);

const find = (year: number, id: FeastId, tradition: Tradition): FeastOccurrence | undefined =>
  feastsOfYear(year).find((o) => o.id === id && o.traditions.includes(tradition));
const dateOf = (year: number, id: FeastId, tradition: Tradition) => find(year, id, tradition)?.date;

describe('calendar dates (civil.ts)', () => {
  it('reads and writes YYYY-MM-DD and refuses impossible dates', () => {
    expect(isIsoDate('2026-03-25')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-3-25')).toBe(false);
    expect(isIsoDate(20260325)).toBe(false);
  });

  it('counts days without any time zone (day numbers, weekdays, months)', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(fromDayNumber(dayNumber('2026-10-07'))).toBe('2026-10-07');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(daysBetween('2026-10-07', '2026-12-25')).toBe(79);
    expect(weekday('2026-10-07')).toBe(3); // a Wednesday
    expect(weekday('2025-04-20')).toBe(0); // Easter Sunday
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2026-12-15', 13)).toBe('2028-01-15');
  });

  it('converts between the Julian and the Gregorian calendars (13 days now, 14 from March 2100)', () => {
    expect(julianToGregorian({ year: 2026, month: 3, day: 25 })).toBe('2026-04-07');
    expect(julianToGregorian({ year: 2025, month: 12, day: 25 })).toBe('2026-01-07');
    expect(julianToGregorian({ year: 2026, month: 9, day: 14 })).toBe('2026-09-27');
    expect(julianToGregorian({ year: 1582, month: 10, day: 5 })).toBe('1582-10-15'); // the day of the reform
    expect(julianToGregorian({ year: 2100, month: 2, day: 28 })).toBe('2100-03-13');
    expect(julianToGregorian({ year: 2100, month: 2, day: 29 })).toBe('2100-03-14'); // a Julian leap day, not a Gregorian one
    expect(julianToGregorian({ year: 2100, month: 3, day: 1 })).toBe('2100-03-15');
    expect(gregorianToJulian('2026-01-07')).toEqual({ year: 2025, month: 12, day: 25 });
    for (let n = dayNumber('1900-03-01'); n < dayNumber('2101-01-01'); n += 37) {
      const date = fromDayNumber(n);
      expect(julianToGregorian(gregorianToJulian(date))).toBe(date);
    }
  });

  it('knows which day it is in Nazareth, whatever the instant and across the clock changes', () => {
    // 22:30 UTC is already the next day in Nazareth (UTC+2 in winter, UTC+3 in summer).
    expect(civilDateIn(new Date('2026-01-14T22:30:00Z'), 'Asia/Jerusalem')).toBe('2026-01-15');
    expect(civilDateIn(new Date('2026-07-14T20:59:00Z'), 'Asia/Jerusalem')).toBe('2026-07-14');
    expect(civilDateIn(new Date('2026-07-14T21:00:00Z'), 'Asia/Jerusalem')).toBe('2026-07-15');
    // The night summer time starts (Friday 27 March 2026, 02:00) and ends (Sunday 25 October 2026, 02:00).
    expect(nazarethToday(new Date('2026-03-26T22:30:00Z'))).toBe('2026-03-27');
    expect(nazarethToday(new Date('2026-10-24T21:30:00Z'))).toBe('2026-10-25');
    expect(nazarethToday(new Date('2026-10-24T20:30:00Z'))).toBe('2026-10-24');
    // ... while the same instant is another day elsewhere.
    expect(civilDateIn(new Date('2026-01-14T22:30:00Z'), 'America/New_York')).toBe('2026-01-14');
    expect(nazarethToday(Date.parse('2026-01-14T22:30:00Z'))).toBe('2026-01-15');
  });
});

describe('Easter (easter.ts)', () => {
  it.each(YEARS)('Western Easter %i matches the published table', (year) => {
    expect(westernEaster(year)).toBe(`${year}-${WESTERN[year]}`);
  });

  it.each(YEARS)('Orthodox Easter %i matches the published table', (year) => {
    expect(orthodoxEaster(year)).toBe(`${year}-${ORTHODOX[year]}`);
  });

  it('every Easter is a Sunday, in its window, and the Orthodox one is never earlier', () => {
    for (let year = 1900; year <= 2099; year += 1) {
      const west = westernEaster(year);
      const east = orthodoxEaster(year);
      expect(weekday(west)).toBe(0);
      expect(weekday(east)).toBe(0);
      expect(west >= `${year}-03-22` && west <= `${year}-04-25`).toBe(true);
      expect(east >= `${year}-04-04` && east <= `${year}-05-08`).toBe(true); // 22 March - 25 April Julian
      expect(daysBetween(west, east) % 7).toBe(0);
      expect([0, 7, 28, 35]).toContain(daysBetween(west, east));
    }
  });

  it('the Orthodox computus gives a Julian date (2026: 30 March Julian = 12 April)', () => {
    expect(orthodoxEasterJulian(2026)).toEqual({ year: 2026, month: 3, day: 30 });
  });

  it('refuses years outside the Gregorian era', () => {
    expect(() => westernEaster(1582)).toThrow(RangeError);
    expect(() => orthodoxEaster(2026.5)).toThrow(RangeError);
  });
});

describe('movable feasts (offsets from Easter of each tradition)', () => {
  const offsets: [FeastId, Tradition, number, number][] = [
    // feast, tradition, days after Easter, weekday
    ['ashWednesday', 'catholic', -46, 3],
    ['cleanMonday', 'orthodox', -48, 1],
    ['palmSunday', 'catholic', -7, 0],
    ['palmSunday', 'orthodox', -7, 0],
    ['holyThursday', 'catholic', -3, 4],
    ['holyThursday', 'orthodox', -3, 4],
    ['goodFriday', 'catholic', -2, 5],
    ['goodFriday', 'orthodox', -2, 5],
    ['holySaturday', 'catholic', -1, 6],
    ['holySaturday', 'orthodox', -1, 6],
    ['easter', 'catholic', 0, 0],
    ['easter', 'orthodox', 0, 0],
    ['divineMercy', 'catholic', 7, 0],
    ['ascension', 'catholic', 39, 4],
    ['ascension', 'orthodox', 39, 4],
    ['pentecost', 'catholic', 49, 0],
    ['pentecost', 'orthodox', 49, 0],
    ['trinity', 'catholic', 56, 0],
    ['corpusChristi', 'catholic', 60, 4],
    ['allSaints', 'orthodox', 56, 0],
  ];

  it.each(offsets)('%s (%s) is Easter %+i, on the right weekday, every year 2000-2040', (id, tradition, offset, day) => {
    for (const year of YEARS) {
      const easterDay = tradition === 'catholic' ? westernEaster(year) : orthodoxEaster(year);
      const date = dateOf(year, id, tradition);
      expect(date, `${id} ${year}`).toBe(addDays(easterDay, offset));
      expect(weekday(date!)).toBe(day);
    }
  });

  it('gives the 2026 dates the parishes announce', () => {
    expect(dateOf(2026, 'ashWednesday', 'catholic')).toBe('2026-02-18');
    expect(dateOf(2026, 'cleanMonday', 'orthodox')).toBe('2026-02-23');
    expect(dateOf(2026, 'goodFriday', 'catholic')).toBe('2026-04-03');
    expect(dateOf(2026, 'goodFriday', 'orthodox')).toBe('2026-04-10');
    expect(dateOf(2026, 'ascension', 'catholic')).toBe('2026-05-14');
    expect(dateOf(2026, 'pentecost', 'catholic')).toBe('2026-05-24');
    expect(dateOf(2026, 'pentecost', 'orthodox')).toBe('2026-05-31');
    expect(dateOf(2026, 'trinity', 'catholic')).toBe('2026-05-31');
    expect(dateOf(2026, 'corpusChristi', 'catholic')).toBe('2026-06-04');
  });

  it('a feast both traditions keep on the same day is one entry for both (Easter 2025)', () => {
    const easter2025 = feastsOn('2025-04-20').filter((o) => o.id === 'easter');
    expect(easter2025).toEqual([{ id: 'easter', date: '2025-04-20', traditions: ['catholic', 'orthodox'], nazareth: false }]);
    expect(feastsOn('2025-04-13').filter((o) => o.id === 'palmSunday')).toHaveLength(1);
    // 2026: a week apart, two entries.
    expect(feastsOfYear(2026).filter((o) => o.id === 'easter').map((o) => [o.date, o.traditions])).toEqual([
      ['2026-04-05', ['catholic']],
      ['2026-04-12', ['orthodox']],
    ]);
  });
});

describe('fixed feasts', () => {
  it('Catholic fixed feasts fall on their Gregorian day', () => {
    const expected: [FeastId, string][] = [
      ['maryMotherOfGod', '01-01'], ['epiphany', '01-06'], ['presentation', '02-02'], ['transfiguration', '08-06'],
      ['assumption', '08-15'], ['nativityOfMary', '09-08'], ['holyCross', '09-14'], ['allSaints', '11-01'], ['christmas', '12-25'],
    ];
    for (const year of YEARS) for (const [id, day] of expected) expect(dateOf(year, id, 'catholic')).toBe(`${year}-${day}`);
  });

  it('Orthodox fixed feasts are on the Julian calendar: 13 days later on ours', () => {
    const expected: [FeastId, string][] = [
      ['christmas', '2026-01-07'], ['epiphany', '2026-01-19'], ['presentation', '2026-02-15'], ['annunciation', '2026-04-07'],
      ['transfiguration', '2026-08-19'], ['assumption', '2026-08-28'], ['nativityOfMary', '2026-09-21'], ['holyCross', '2026-09-27'],
    ];
    for (const [id, date] of expected) expect(dateOf(2026, id, 'orthodox'), id).toBe(date);
    const christmas = find(2026, 'christmas', 'orthodox')!;
    expect(christmas.julian).toEqual({ month: 12, day: 25 });
    // 25 December 2026 on the Julian calendar is 7 January 2027: one Orthodox Christmas per year, in January.
    expect(feastsOfYear(2026).filter((o) => o.id === 'christmas' && o.traditions.includes('orthodox'))).toHaveLength(1);
    expect(dateOf(2027, 'christmas', 'orthodox')).toBe('2027-01-07');
  });

  it('marks Nazareth\'s own feasts: the Annunciation and the Holy Cross, in both traditions', () => {
    const own = feastsOfYear(2026).filter((o) => o.nazareth).map((o) => `${o.id} ${o.date} ${o.traditions.join('+')}`);
    expect(own).toEqual(['annunciation 2026-03-25 catholic', 'annunciation 2026-04-07 orthodox', 'holyCross 2026-09-14 catholic', 'holyCross 2026-09-27 orthodox']);
  });

  it('Advent: four Sundays, the fourth the last Sunday before Christmas', () => {
    const first: Record<number, string> = { 2011: '11-27', 2017: '12-03', 2022: '11-27', 2023: '12-03', 2024: '12-01', 2025: '11-30', 2026: '11-29', 2027: '11-28' };
    for (const [year, day] of Object.entries(first)) expect(adventSunday(Number(year), 1)).toBe(`${year}-${day}`);
    expect(adventSunday(2011, 4)).toBe('2011-12-18'); // Christmas on a Sunday
    expect(adventSunday(2023, 4)).toBe('2023-12-24'); // Christmas on a Monday
    for (const year of YEARS) {
      for (const n of [1, 2, 3, 4] as const) expect(weekday(adventSunday(year, n))).toBe(0);
      expect(daysBetween(adventSunday(year, 4), `${year}-12-25`)).toBeGreaterThanOrEqual(1);
      expect(daysBetween(adventSunday(year, 4), `${year}-12-25`)).toBeLessThanOrEqual(7);
    }
  });
});

describe('Roman Rite transfers (St Joseph, the Annunciation, the Immaculate Conception)', () => {
  it('moves St Joseph out of Holy Week and off a Sunday of Lent', () => {
    expect(dateOf(2008, 'stJoseph', 'catholic')).toBe('2008-03-15'); // Wednesday of Holy Week -> Saturday before Palm Sunday
    expect(dateOf(2035, 'stJoseph', 'catholic')).toBe('2035-03-17'); // Monday of Holy Week
    expect(dateOf(2023, 'stJoseph', 'catholic')).toBe('2023-03-20'); // 4th Sunday of Lent -> Monday
    expect(dateOf(2026, 'stJoseph', 'catholic')).toBe('2026-03-19'); // a Thursday of Lent: unchanged
    expect(find(2023, 'stJoseph', 'catholic')?.transferredFrom).toBe('2023-03-19');
    expect(find(2026, 'stJoseph', 'catholic')?.transferredFrom).toBeUndefined();
  });

  it('moves the Annunciation after the Easter Octave, or off a Sunday of Lent', () => {
    expect(dateOf(2008, 'annunciation', 'catholic')).toBe('2008-03-31'); // Easter Tuesday
    expect(dateOf(2016, 'annunciation', 'catholic')).toBe('2016-04-04'); // Good Friday
    expect(dateOf(2018, 'annunciation', 'catholic')).toBe('2018-04-09'); // Palm Sunday
    expect(dateOf(2024, 'annunciation', 'catholic')).toBe('2024-04-08'); // Monday of Holy Week
    expect(dateOf(2027, 'annunciation', 'catholic')).toBe('2027-04-05'); // Holy Thursday
    expect(dateOf(2035, 'annunciation', 'catholic')).toBe('2035-04-02'); // Easter Sunday itself
    expect(dateOf(2012, 'annunciation', 'catholic')).toBe('2012-03-26'); // 5th Sunday of Lent -> Monday
    expect(dateOf(2026, 'annunciation', 'catholic')).toBe('2026-03-25'); // a Wednesday of Lent
    // The Orthodox Annunciation is never moved, even on Pascha.
    expect(dateOf(2024, 'annunciation', 'orthodox')).toBe('2024-04-07');
  });

  it('moves the Immaculate Conception off the Second Sunday of Advent', () => {
    expect(dateOf(2019, 'immaculateConception', 'catholic')).toBe('2019-12-09');
    expect(dateOf(2024, 'immaculateConception', 'catholic')).toBe('2024-12-09');
    expect(dateOf(2026, 'immaculateConception', 'catholic')).toBe('2026-12-08');
    expect(transferredDate('immaculateConception', '2030-12-08')).toBe('2030-12-09');
  });
});

describe('nextFeasts and ranges (the API other pages use)', () => {
  it('lists the next feasts from a day, that day included', () => {
    expect(nextFeasts('2026-10-07', 3).map((o) => `${o.id} ${o.date}`)).toEqual([
      'allSaints 2026-11-01',
      'advent1 2026-11-29',
      'advent2 2026-12-06',
    ]);
    expect(nextFeasts('2026-11-01', 1)[0]).toMatchObject({ id: 'allSaints', date: '2026-11-01' });
  });

  it('filters by tradition, and crosses into the next year', () => {
    expect(nextFeasts('2026-10-07', 3, 'orthodox').map((o) => `${o.id} ${o.date}`)).toEqual([
      'christmas 2027-01-07',
      'epiphany 2027-01-19',
      'presentation 2027-02-15',
    ]);
    expect(nextFeasts('2026-12-26', 2, 'catholic').map((o) => `${o.id} ${o.date}`)).toEqual(['maryMotherOfGod 2027-01-01', 'epiphany 2027-01-06']);
    // A feast both celebrate that day counts for either filter.
    expect(nextFeasts('2025-04-19', 1, 'orthodox')[0]).toMatchObject({ id: 'holySaturday', traditions: ['catholic', 'orthodox'] });
  });

  it('takes an instant and uses its day in Nazareth (not UTC, not the visitor\'s zone)', () => {
    // 22:30 UTC on 13 September is 01:30 on 14 September in Nazareth: the Holy Cross is "today".
    const instant = new Date('2026-09-13T22:30:00Z');
    expect(nextFeasts(instant, 1, 'catholic')[0]).toMatchObject({ id: 'holyCross', date: '2026-09-14' });
  });

  it('is sorted, never repeats, and stays sane for n', () => {
    const many = nextFeasts('2026-01-01', 100);
    expect(many).toHaveLength(100);
    const keys = many.map((o) => `${o.date}|${o.id}|${o.traditions.join()}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(many.map((o) => o.date)).toEqual([...many.map((o) => o.date)].sort()); // (ISO dates sort as text)
    expect(nextFeasts('2026-01-01', 0)).toEqual([]);
    expect(nextFeasts('2026-01-01', -3)).toEqual([]);
    expect(nextFeasts('2026-01-01', 5000)).toHaveLength(100);
    expect(() => nextFeasts('2026-02-30', 1)).toThrow(RangeError);
  });

  it('feastsBetween covers a range across years; every feast appears once a year in each of its traditions', () => {
    const range = feastsBetween('2026-12-20', '2027-01-20', 'all').map((o) => `${o.date} ${o.id}`);
    expect(range).toEqual([
      '2026-12-20 advent4',
      '2026-12-25 christmas',
      '2027-01-01 maryMotherOfGod',
      '2027-01-06 epiphany',
      '2027-01-07 christmas',
      '2027-01-19 epiphany',
    ]);
    expect(feastsBetween('2027-01-20', '2026-12-20')).toEqual([]);
    for (const year of YEARS) {
      const list = feastsOfYear(year);
      for (const feast of FEASTS) {
        for (const tradition of ['catholic', 'orthodox'] as const) {
          const has = tradition in feast;
          expect(list.filter((o) => o.id === feast.id && o.traditions.includes(tradition)), `${feast.id} ${tradition} ${year}`).toHaveLength(has ? 1 : 0);
        }
      }
    }
  });
});
