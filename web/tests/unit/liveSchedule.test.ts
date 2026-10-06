import { describe, expect, it } from 'vitest';
import {
  broadcastView,
  countdownParts,
  countdownSummary,
  fetchScheduleInBrowser,
  formatBroadcastTime,
  formatVisitorTime,
  parseSchedule,
  scheduleView,
  STARTING_SOON_MS,
  type ScheduledBroadcast,
} from '@/lib/liveSchedule';

// The broadcasts announced from the dashboard (GET /live/schedule, docs/LIVE.md) as the /live page reads and shows them.
// No test reaches the network: fetch is passed in.

const ID = (n: number) => n.toString(16).padStart(24, 'a');
const item = (over: Record<string, unknown> = {}) => ({
  id: ID(1),
  title: 'Evening prayer &amp; vespers',
  description: 'From the Basilica',
  startsAt: '2026-10-25T08:00:00.000Z',
  status: 'scheduled',
  ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const minute = 60_000;
const hour = 60 * minute;

describe('parseSchedule', () => {
  it('reads the announced broadcasts, decodes the stored text and puts the soonest first', () => {
    const later = item({ id: ID(2), title: 'Later', startsAt: '2026-11-01T08:00:00Z', description: null, status: 'live' });
    expect(parseSchedule({ timeZone: 'Asia/Jerusalem', items: [later, item()] })).toEqual([
      { id: ID(1), title: 'Evening prayer & vespers', description: 'From the Basilica', start: Date.parse('2026-10-25T08:00:00Z'), status: 'scheduled' },
      { id: ID(2), title: 'Later', description: '', start: Date.parse('2026-11-01T08:00:00Z'), status: 'live' },
    ]);
  });

  it('drops an item without a valid id, title or start, and keeps the others', () => {
    const items = [item(), item({ id: 'nope' }), item({ id: ID(3), title: '' }), item({ id: ID(4), startsAt: 'tomorrow' }), item({ id: ID(5), title: 'x'.repeat(401) }), null, 'text'];
    expect(parseSchedule({ items }).map((b) => b.id)).toEqual([ID(1)]);
    expect(parseSchedule({ items: 'none' })).toEqual([]);
    expect(parseSchedule(null)).toEqual([]);
    expect(parseSchedule({ items: Array.from({ length: 80 }, (_, i) => item({ id: ID(100 + i) })) })).toHaveLength(50);
  });

  it('reads once from the browser without cookies; a 404 (an API without the route) is "nothing announced", a failure is null', async () => {
    const calls: [string, RequestInit][] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return json({ items: [item()] });
    }) as unknown as typeof fetch;
    expect(await fetchScheduleInBrowser(ok)).toHaveLength(1);
    expect(calls[0][0]).toMatch(/\/live\/schedule$/);
    expect(calls[0][1].credentials).toBe('omit');
    expect(await fetchScheduleInBrowser((async () => json({ error: 'Not found' }, 404)) as unknown as typeof fetch)).toEqual([]);
    expect(await fetchScheduleInBrowser((async () => json({ error: 'busy' }, 429)) as unknown as typeof fetch)).toBeNull();
    expect(await fetchScheduleInBrowser((async () => { throw new TypeError('offline'); }) as unknown as typeof fetch)).toBeNull();
  });
});

describe('scheduleView: what the top of /live shows', () => {
  const at = (iso: string) => Date.parse(iso);
  const first: ScheduledBroadcast = { id: ID(1), title: 'A', description: '', start: at('2026-10-25T08:00:00Z'), status: 'scheduled' };
  const second: ScheduledBroadcast = { id: ID(2), title: 'B', description: '', start: at('2026-11-01T08:00:00Z'), status: 'scheduled' };

  it('counts down to the soonest broadcast and lists the others', () => {
    expect(scheduleView([first, second], first.start - hour, false)).toEqual({ next: first, phase: 'countdown', others: [second] });
  });

  it('says "starting soon" from the start for half an hour, then moves on to the next one', () => {
    expect(scheduleView([first, second], first.start, false).phase).toBe('soon');
    expect(scheduleView([first, second], first.start + STARTING_SOON_MS - 1, false)).toEqual({ next: first, phase: 'soon', others: [second] });
    expect(scheduleView([first, second], first.start + STARTING_SOON_MS, false)).toEqual({ next: second, phase: 'countdown', others: [] });
  });

  it('shows no countdown while a broadcast is live (the player is there); the list keeps the live one only if it is the announced one', () => {
    const live = { ...first, status: 'live' as const };
    expect(scheduleView([live, second], first.start + 10 * minute, true)).toEqual({ next: null, phase: null, others: [live, second] });
    // the schedule alone never makes it "live": the status poll must agree
    expect(scheduleView([live, second], first.start + 10 * minute, false).next).toBe(live);
  });

  it('is empty when nothing is announced', () => {
    expect(scheduleView([], Date.now(), false)).toEqual({ next: null, phase: null, others: [] });
  });
});

describe('the countdown', () => {
  it('splits the remaining time into days, hours, minutes and seconds, never below zero', () => {
    const ms = ((2 * 24 + 3) * 60 * 60 + 4 * 60 + 5) * 1000 + 999;
    expect(countdownParts(ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
    expect(countdownParts(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('counts real hours across the Israel clock change (25 hours on 25 October 2026, 23 on 26 March 2027)', () => {
    // Verify with Intl that these are the nights the clocks change in Asia/Jerusalem.
    const offset = (iso: string) =>
      new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jerusalem', timeZoneName: 'shortOffset' }).formatToParts(Date.parse(iso)).find((p) => p.type === 'timeZoneName')?.value;
    expect(offset('2026-10-24T12:00:00Z')).toBe('GMT+3');
    expect(offset('2026-10-25T12:00:00Z')).toBe('GMT+2');
    expect(offset('2027-03-25T12:00:00Z')).toBe('GMT+2');
    expect(offset('2027-03-26T12:00:00Z')).toBe('GMT+3');

    // 10:00 Nazareth time on Saturday -> 10:00 Nazareth time on Sunday, across the night the clocks go back.
    const saturday = Date.parse('2026-10-24T10:00:00+03:00');
    const sunday = Date.parse('2026-10-25T10:00:00+02:00');
    expect(countdownParts(sunday - saturday)).toEqual({ days: 1, hours: 1, minutes: 0, seconds: 0 });
    expect(formatBroadcastTime(sunday, 'en')).toMatch(/10:00/);
    expect(formatBroadcastTime(saturday, 'en')).toMatch(/10:00/);

    const thursday = Date.parse('2027-03-25T10:00:00+02:00');
    const friday = Date.parse('2027-03-26T10:00:00+03:00');
    expect(countdownParts(friday - thursday)).toEqual({ days: 0, hours: 23, minutes: 0, seconds: 0 });
    expect(formatBroadcastTime(friday, 'en')).toMatch(/10:00/);
  });

  it('gives screen readers one sentence that changes at most once a minute, never "0 minutes"', () => {
    expect(countdownSummary(((2 * 24 + 3) * 60 + 4) * minute + 5000)).toEqual({ kind: 'days', days: 2, hours: 3, minutes: 5 });
    expect(countdownSummary(3 * hour + 4 * minute)).toEqual({ kind: 'hours', days: 0, hours: 3, minutes: 4 });
    expect(countdownSummary(4 * minute + 1)).toEqual({ kind: 'minutes', days: 0, hours: 0, minutes: 5 });
    expect(countdownSummary(1000)).toEqual({ kind: 'minutes', days: 0, hours: 0, minutes: 1 });
    // the same sentence for every second of a minute
    const base = 10 * minute;
    expect(new Set(Array.from({ length: 60 }, (_, s) => JSON.stringify(countdownSummary(base - s * 1000 - 1)))).size).toBe(1);
  });
});

describe('dates and times of a broadcast', () => {
  const start = Date.parse('2026-10-25T08:00:00Z'); // 10:00 in Nazareth (winter time), 04:00 in New York

  it('writes Nazareth time in the page language with Western digits (en, de, he, ar)', () => {
    expect(formatBroadcastTime(start, 'en')).toBe('Sunday, October 25, 2026 at 10:00 AM');
    expect(formatBroadcastTime(start, 'de')).toBe('Sonntag, 25. Oktober 2026 um 10:00');
    for (const locale of ['he', 'ar']) {
      const text = formatBroadcastTime(start, locale);
      expect(text, locale).toMatch(/25/);
      expect(text, locale).toMatch(/2026/);
      expect(text, locale).toMatch(/10:00/);
      expect(text, locale).not.toMatch(/[٠-٩۰-۹]/);
    }
    expect(broadcastView({ id: ID(1), title: 'A', description: '', start, status: 'scheduled' }, 'en').when).toBe(formatBroadcastTime(start, 'en'));
  });

  it('writes the visitor\'s own time with the zone, or nothing when it is the same as Nazareth\'s', () => {
    expect(formatVisitorTime(start, 'en', 'America/New_York')).toMatch(/4:00 AM EDT/);
    expect(formatVisitorTime(start, 'de', 'Europe/Berlin')).toMatch(/09:00 MEZ/);
    expect(formatVisitorTime(start, 'ar', 'America/New_York')).toMatch(/4:00/);
    expect(formatVisitorTime(start, 'ar', 'America/New_York')).not.toMatch(/[٠-٩۰-۹]/);
    expect(formatVisitorTime(start, 'he', 'America/New_York')).toMatch(/4:00/);
    expect(formatVisitorTime(start, 'en', 'Asia/Jerusalem')).toBeNull();
    expect(formatVisitorTime(start, 'he', 'Asia/Jerusalem')).toBeNull();
  });
});
