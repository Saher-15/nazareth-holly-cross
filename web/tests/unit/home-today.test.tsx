import { cleanup, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BROADCAST_GRACE_MS,
  nextBroadcast,
  parseSchedule,
  peekSchedule,
  resetSchedule,
  SCHEDULE_TTL_MS,
  type ScheduledBroadcast,
} from '@/components/home/broadcast';
import { loadPrayerWall, NEWEST_PRAYERS } from '@/components/home/data';
import { feastOn, feastsOfYear, orthodoxEaster, westernEaster } from '@/components/home/feasts';

import { NewestPrayersView } from '@/components/home/NewestPrayers';
import SitesMap from '@/components/home/SitesMap';
import { formatClock, formatDuration, formatInDays } from '@/components/home/today';
import { broadcastState, TodayView } from '@/components/home/TodayInNazareth';
import type { Prayer } from '@/lib/api';
import { NAZARETH_COORDS, sunTimes } from '@/lib/sun';

import en from '@/messages/en.json';
import he from '@/messages/he.json';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en${href}`} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const withIntl = (ui: ReactNode, locale = 'en', messages: object = en) => (
  <NextIntlClientProvider locale={locale} messages={messages as never} timeZone="Asia/Jerusalem">
    {ui}
  </NextIntlClientProvider>
);

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Minutes after midnight in Nazareth of a moment. */
const nazarethMinutes = (date: Date) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jerusalem' })
    .format(date)
    .split(':')
    .map(Number);
  return h * 60 + m;
};

describe('sunrise and sunset (computed, no service)', () => {
  // An independent check: the "Almanac for Computers" (US Naval Observatory, 1990) algorithm, a different set of
  // equations. The two must agree within two minutes; a sign or time-zone mistake would be hours off.
  function almanac(isoDate: string, rising: boolean) {
    const { lat, lng } = NAZARETH_COORDS;
    const rad = Math.PI / 180;
    const d = new Date(`${isoDate}T00:00:00Z`);
    const n = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000);
    const lngHour = lng / 15;
    const t = n + ((rising ? 6 : 18) - lngHour) / 24;
    const m = 0.9856 * t - 3.289;
    let l = m + 1.916 * Math.sin(m * rad) + 0.02 * Math.sin(2 * m * rad) + 282.634;
    l = ((l % 360) + 360) % 360;
    let ra = Math.atan(0.91764 * Math.tan(l * rad)) / rad;
    ra = ((ra % 360) + 360) % 360;
    ra = (ra + Math.floor(l / 90) * 90 - Math.floor(ra / 90) * 90) / 15;
    const sinDec = 0.39782 * Math.sin(l * rad);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
    const h = (rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad) / 15;
    const localMean = h + ra - 0.06571 * t - 6.622;
    const ut = (((localMean - lngHour) % 24) + 24) % 24;
    return day(isoDate) + ut * 3_600_000;
  }

  for (const date of ['2026-01-15', '2026-03-20', '2026-06-21', '2026-10-07', '2026-12-21', '2030-07-04']) {
    it(`agrees with an independent almanac on ${date}`, () => {
      const { sunrise, sunset } = sunTimes(date);
      expect(Math.abs(sunrise!.getTime() - almanac(date, true))).toBeLessThan(2 * 60_000);
      expect(Math.abs(sunset!.getTime() - almanac(date, false))).toBeLessThan(2 * 60_000);
    });
  }

  it('gives Nazareth the day lengths of its latitude (about 14 h 18 min in June, 10 h in December)', () => {
    const length = (date: string) => {
      const { sunrise, sunset } = sunTimes(date);
      return (sunset!.getTime() - sunrise!.getTime()) / 60_000;
    };
    // cos H = (sin(-0.833°) - sin 32.7° sin δ) / (cos 32.7° cos δ), with δ = ±23.44°: H = 107.3° and 75.0°
    expect(length('2026-06-21')).toBeGreaterThan(14 * 60 + 14);
    expect(length('2026-06-21')).toBeLessThan(14 * 60 + 22);
    expect(length('2026-12-21')).toBeGreaterThan(9 * 60 + 56);
    expect(length('2026-12-21')).toBeLessThan(10 * 60 + 4);
  });

  it('puts sunrise in the morning and sunset in the evening of Nazareth, summer and winter time alike', () => {
    for (const date of ['2026-01-15', '2026-07-15', '2026-10-07']) {
      const { sunrise, sunset } = sunTimes(date);
      expect(nazarethMinutes(sunrise!)).toBeGreaterThan(4 * 60 + 30);
      expect(nazarethMinutes(sunrise!)).toBeLessThan(7 * 60);
      expect(nazarethMinutes(sunset!)).toBeGreaterThan(16 * 60 + 30);
      expect(nazarethMinutes(sunset!)).toBeLessThan(20 * 60);
    }
  });

  it('says so when the sun does not rise or set (polar day and night)', () => {
    expect(sunTimes('2026-06-21', { lat: 78, lng: 15 })).toEqual({ sunrise: null, sunset: null });
    expect(sunTimes('2026-12-21', { lat: 78, lng: 15 })).toEqual({ sunrise: null, sunset: null });
  });
});

describe('feasts (minimal calendar, until the liturgical calendar replaces it)', () => {
  it('computes Western and Orthodox Easter', () => {
    const western = { 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2030: '2030-04-21', 2038: '2038-04-25' };
    const orthodox = { 2024: '2024-05-05', 2025: '2025-04-20', 2026: '2026-04-12', 2027: '2027-05-02', 2030: '2030-04-28' };
    for (const [year, date] of Object.entries(western)) expect(iso(westernEaster(Number(year)))).toBe(date);
    for (const [year, date] of Object.entries(orthodox)) expect(iso(orthodoxEaster(Number(year)))).toBe(date);
  });

  it('moves the Annunciation out of Holy Week, the Easter octave and the Sundays of Lent, as the Roman rite does', () => {
    const annunciation = (year: number) => feastsOfYear(year).find((f) => f.key === 'annunciation')!.date;
    expect(annunciation(2026)).toBe('2026-03-25'); // a Wednesday of Lent
    expect(annunciation(2024)).toBe('2024-04-08'); // Monday of Holy Week -> after the octave
    expect(annunciation(2029)).toBe('2029-04-09'); // Palm Sunday -> after the octave
    expect(annunciation(2035)).toBe('2035-04-02'); // Easter Sunday itself
    expect(annunciation(2028)).toBe('2028-03-25'); // a Saturday
    expect(annunciation(2012)).toBe('2012-03-26'); // the fifth Sunday of Lent -> the Monday
    expect(annunciation(2040)).toBe('2040-04-09'); // Palm Sunday -> after the octave
  });

  it('leaves Orthodox Easter out when both churches keep Easter on the same day', () => {
    expect(feastsOfYear(2025).filter((f) => f.key.endsWith('aster'))).toEqual([{ key: 'easter', date: '2025-04-20' }]);
    expect(feastsOfYear(2026).filter((f) => f.key.endsWith('aster')).map((f) => f.key)).toEqual(['easter', 'orthodoxEaster']);
  });

  it('names the feast of the day, or the next one with the days to wait, across the new year', () => {
    expect(feastOn('2026-09-14')).toEqual({ key: 'holyCross', date: '2026-09-14', today: true, days: 0 });
    expect(feastOn('2026-10-07')).toEqual({ key: 'christmas', date: '2026-12-25', today: false, days: 79 });
    expect(feastOn('2026-12-26')).toEqual({ key: 'epiphany', date: '2027-01-06', today: false, days: 11 });
    expect(feastOn('2027-01-07').key).toBe('orthodoxChristmas');
  });

  it('has a name in every language for every feast it can return', () => {
    const keys = new Set([2025, 2026, 2027, 2028].flatMap((y) => feastsOfYear(y).map((f) => f.key)));
    for (const key of keys) {
      expect(en.home.today.feasts[key]).toBeTruthy();
      expect(he.home.today.feasts[key]).toBeTruthy();
    }
  });
});

describe('formatting of the strip', () => {
  it('writes times, durations and days to wait in the page language, with Western digits', () => {
    const at = Date.UTC(2026, 9, 7, 11, 32); // 14:32 in Nazareth (summer time)
    expect(formatClock(at, 'he')).toBe('14:32');
    expect(formatClock(at, 'ar')).toMatch(/2:32/);
    expect(formatDuration((2 * 24 * 60 + 4 * 60 + 12) * 60_000, 'en')).toMatch(/^2 days,? 4 hours$/);
    expect(formatDuration((3 * 60 + 5) * 60_000, 'en')).toMatch(/^3 hours,? 5 minutes$/);
    expect(formatDuration(8 * 60_000 + 59_000, 'en')).toBe('8 minutes');
    expect(formatDuration(2 * 24 * 3_600_000, 'en')).toBe('2 days'); // no "0 hours"
    expect(formatInDays(1, 'en')).toBe('tomorrow');
    expect(formatInDays(79, 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatInDays(79, 'ar')).toMatch(/79/);
  });
});

const broadcast = (over: Partial<ScheduledBroadcast> = {}): ScheduledBroadcast => ({
  id: 'b1',
  title: 'Mass at the Basilica',
  startsAt: Date.UTC(2026, 9, 11, 7, 0),
  status: 'scheduled',
  ...over,
});

describe('the next broadcast (GET /live/schedule)', () => {
  it('reads the contract and skips items that do not match it, one by one', () => {
    const items = parseSchedule({
      timeZone: 'Asia/Jerusalem',
      items: [
        { id: 'b2', title: 'Vespers', description: '', startsAt: '2026-10-12T15:00:00.000Z', status: 'scheduled' },
        { id: 'b1', title: 'Mass &amp; prayers', startsAt: '2026-10-11T07:00:00.000Z', status: 'scheduled' },
        { id: 'bad', title: '', startsAt: 'soon', status: 'scheduled' },
        { id: 'b3', title: 'Cancelled', startsAt: '2026-10-13T07:00:00.000Z', status: 'cancelled' },
      ],
    });
    expect(items?.map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(items?.[0].title).toBe('Mass & prayers');
    expect(parseSchedule({ nothing: true })).toBeNull();
    expect(parseSchedule('<html>')).toBeNull();
  });

  it('announces a live one first, else the soonest still to come', () => {
    const now = Date.UTC(2026, 9, 7, 12, 0);
    const later = broadcast({ id: 'later', startsAt: now + 5 * 86_400_000 });
    const soon = broadcast({ id: 'soon', startsAt: now + 3_600_000 });
    const old = broadcast({ id: 'old', startsAt: now - BROADCAST_GRACE_MS - 60_000 });
    expect(nextBroadcast([old, soon, later], now)?.id).toBe('soon');
    expect(nextBroadcast([soon, broadcast({ id: 'on', status: 'live', startsAt: now - 600_000 })], now)?.id).toBe('on');
    expect(nextBroadcast([old], now)).toBeNull();
    expect(nextBroadcast(null, now)).toBeNull();
  });

  it('prefers the live status the header uses, then the schedule; nothing when there is neither', () => {
    const now = Date.UTC(2026, 9, 7, 12, 0);
    const live = { live: true as const, title: 'Rosary', startedAt: now - 60_000, playbackUrl: 'x' };
    expect(broadcastState(live, null, now)).toEqual({ live: true, title: 'Rosary' });
    expect(broadcastState({ live: false }, [broadcast({ startsAt: now + 1000 })], now)).toMatchObject({ live: false });
    expect(broadcastState({ live: false }, null, now)).toBeNull();
  });

  describe('peekSchedule', () => {
    beforeEach(() => resetSchedule());
    const json = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

    it('hides the broadcast when the API has no schedule yet (404) and asks again only after a minute', async () => {
      const fetcher = json(404, { error: 'not found' });
      expect(await peekSchedule(0, fetcher as unknown as typeof fetch)).toBeNull();
      expect(await peekSchedule(SCHEDULE_TTL_MS - 1, fetcher as unknown as typeof fetch)).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(1);
      await peekSchedule(SCHEDULE_TTL_MS, fetcher as unknown as typeof fetch);
      await new Promise((r) => setTimeout(r, 0));
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('keeps the last good schedule when a later read fails', async () => {
      const good = json(200, { items: [{ id: 'b1', title: 'Mass', startsAt: '2026-10-11T07:00:00Z', status: 'scheduled' }] });
      expect(await peekSchedule(0, good as unknown as typeof fetch)).toHaveLength(1);
      const failing = vi.fn(async () => {
        throw new Error('offline');
      });
      // stale: answered at once with what we had, the refresh fails in the background
      expect(await peekSchedule(SCHEDULE_TTL_MS, failing as unknown as typeof fetch)).toHaveLength(1);
      await new Promise((r) => setTimeout(r, 0));
      expect(failing).toHaveBeenCalledTimes(1);
      expect(await peekSchedule(SCHEDULE_TTL_MS * 2, failing as unknown as typeof fetch)).toHaveLength(1);
      await new Promise((r) => setTimeout(r, 0));
      expect(failing).toHaveBeenCalledTimes(2);
    });

    it('never makes the first page wait long for a slow API', async () => {
      const slow = vi.fn(() => new Promise<Response>(() => {}));
      const started = Date.now();
      expect(await peekSchedule(0, slow as unknown as typeof fetch)).toBeNull();
      expect(Date.now() - started).toBeLessThan(2000);
    });
  });
});

describe('<TodayView>', () => {
  const now = Date.UTC(2026, 9, 7, 11, 32); // Wednesday 7 October 2026, 14:32 in Nazareth
  // The clock and the countdown follow the browser's clock: pin it to the moment of the "server render".
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(now + 5_000);
  });
  afterEach(() => vi.useRealTimers());

  it('shows the time, the sun and the next feast, and leaves the broadcast out when there is none', () => {
    render(withIntl(<TodayView id="home-today" locale="en" now={now} broadcast={null} />));
    const section = screen.getByRole('region', { name: en.home.today.title });
    expect(within(section).getByText(/^2:32\sPM$/)).toHaveAttribute('dateTime', '14:32');
    expect(section).toHaveTextContent('Wednesday, October 7');
    expect(section).toHaveTextContent(/Sunrise \d{1,2}:\d{2}/);
    expect(section).toHaveTextContent(en.home.today.feasts.christmas);
    expect(section).toHaveTextContent('in 79 days');
    expect(section.querySelector('[data-broadcast]')).toBeNull();
  });

  it('announces the next broadcast with its start in Nazareth time and a countdown in minutes', () => {
    const next = broadcast({ startsAt: now + (2 * 24 * 60 + 4 * 60 + 12) * 60_000 });
    render(withIntl(<TodayView id="home-today" locale="en" now={now} broadcast={{ live: false, next }} />));
    const item = document.querySelector('[data-broadcast="next"]') as HTMLElement;
    expect(item).toHaveTextContent(en.home.today.broadcastNext);
    expect(item).toHaveTextContent('Mass at the Basilica');
    expect(item).toHaveTextContent(/Starts in 2 days,? 4 hours/);
    expect(within(item).getByRole('link', { name: en.home.today.livePage })).toHaveAttribute('href', '/en/live');
  });

  it('says "Live now" in words (not by colour alone) and links to the broadcast', () => {
    render(withIntl(<TodayView id="home-today" locale="en" now={now} broadcast={{ live: true, title: 'Rosary' }} />));
    const item = document.querySelector('[data-broadcast="live"]') as HTMLElement;
    expect(item).toHaveTextContent(en.communityPage.live.now.badge);
    expect(within(item).getByRole('link', { name: en.home.today.watch })).toHaveAttribute('href', '/en/live');
  });

  it('works right to left in Hebrew, with Western digits', () => {
    render(withIntl(<TodayView id="home-today" locale="he" now={now} broadcast={null} />, 'he', he));
    const section = screen.getByRole('region', { name: he.home.today.title });
    expect(section).toHaveTextContent('14:32');
    expect(section.textContent).not.toMatch(/[٠-٩]/);
  });
});

const prayer = (i: number, over: Partial<Prayer> = {}): Prayer => ({
  _id: `p${i}`,
  name: `Pilgrim ${i}`,
  country: ['Italy', 'Brazil', 'Italy', 'Philippines', 'Somewhere far'][i % 5],
  prayer: `Prayer number ${i}`,
  category: 'Peace',
  likes: 0,
  createdAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

describe('the prayer wall on the home page', () => {
  it('counts the prayers (the API total) and the known countries of the newest ones', async () => {
    const wall = await loadPrayerWall(async () => ({ prayers: Array.from({ length: 10 }, (_, i) => prayer(i)), total: 1284 }));
    expect(wall).toMatchObject({ total: 1284, sample: 10, countries: 3 }); // Italy, Brazil, Philippines; free text is not guessed
    expect(wall?.newest).toHaveLength(NEWEST_PRAYERS);
  });

  it('hides the section when the wall is empty or cannot be read', async () => {
    expect(await loadPrayerWall(async () => ({ prayers: [], total: 0 }))).toBeNull();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadPrayerWall(async () => Promise.reject(new Error('429')))).toBeNull();
  });

  it('shows the figures with their meaning and the newest prayers, cleaned like the wall', () => {
    const newest = [prayer(1, { prayer: 'Pray for us, see www.spam.example' }), prayer(2), prayer(3)];
    render(withIntl(<NewestPrayersView id="home-prayers" wall={{ total: 1284, newest, sample: 50, countries: 21 }} />));
    expect(screen.getByTestId('prayers-total')).toHaveTextContent('1,284');
    expect(screen.getByText('Countries in the newest 50 prayers')).toBeInTheDocument();
    expect(screen.getByTestId('prayers-countries')).toHaveTextContent('21');
    expect(screen.getByText(/Pray for us, see …/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.home.prayersAll })).toHaveAttribute('href', '/en/prayers');
  });

  it('says "on the wall" when every prayer was counted', () => {
    render(withIntl(<NewestPrayersView id="home-prayers" wall={{ total: 3, newest: [prayer(1)], sample: 3, countries: 2 }} />));
    expect(screen.getByText(en.home.prayersCountriesAll)).toBeInTheDocument();
  });
});

describe('<SitesMap>', () => {
  it('lists the five holy sites with the walking minutes from the basilica, and keeps the drawing out of the reading order', () => {
    render(withIntl(<SitesMap id="home-map" />));
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('a')?.getAttribute('href'))).toEqual([
      '/en/sites/latin',
      '/en/sites/greek',
      '/en/sites/maryswell',
      '/en/sites/oldcity',
      '/en/sites/city',
    ]);
    expect(items[3]).toHaveTextContent('4 min');
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // every pin is inside the drawing
    for (const pin of document.querySelectorAll('svg g[transform^="translate"]')) {
      const [x, y] = (pin.getAttribute('transform') ?? '').match(/-?[\d.]+/g)!.map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(400);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(300);
    }
  });
});
