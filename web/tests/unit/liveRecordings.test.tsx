import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecordingList from '@/components/community/RecordingList';
import { buildIcs, icsUtc } from '@/data/pilgrim/ics';
import { recordingVideoJsonLd } from '@/lib/jsonLd';
import {
  fetchRecordingsInBrowser,
  formatDuration,
  formatRecordingDate,
  isoDuration,
  nazarethDay,
  parseRecordings,
  recordingView,
  THUMBNAIL_URL,
} from '@/lib/liveRecordings';
import en from '@/messages/en.json';

// Recordings of past broadcasts (GET /live/recordings), their structured data, the announced broadcasts' structured
// data and their calendar file. No test reaches the network.

const VIDEO = 'a1'.repeat(16);
const PLAYER = `https://customer-abc123.cloudflarestream.com/${VIDEO}/iframe`;
const THUMB = `https://customer-abc123.cloudflarestream.com/${VIDEO}/thumbnails/thumbnail.jpg`;
const ID = (n: number) => n.toString(16).padStart(24, 'b');
const item = (over: Record<string, unknown> = {}) => ({
  id: ID(1),
  title: 'Vespers &amp; rosary',
  date: '2026-10-04T16:00:00.000Z',
  durationSeconds: 3905,
  thumbnailUrl: THUMB,
  playbackUrl: PLAYER,
  ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('parseRecordings', () => {
  it('reads the published recordings, decodes the stored text and puts the newest broadcast first', () => {
    const older = item({ id: ID(2), title: 'Older', date: '2026-09-01T08:00:00Z', durationSeconds: null });
    expect(parseRecordings({ items: [older, item()] })).toEqual([
      { id: ID(1), title: 'Vespers & rosary', date: Date.parse('2026-10-04T16:00:00Z'), durationSeconds: 3905, thumbnailUrl: THUMB, playbackUrl: PLAYER },
      { id: ID(2), title: 'Older', date: Date.parse('2026-09-01T08:00:00Z'), durationSeconds: 0, thumbnailUrl: THUMB, playbackUrl: PLAYER },
    ]);
  });

  it('drops anything whose poster or player is not Cloudflare Stream’s exact address', () => {
    const bad = [
      item({ id: ID(2), playbackUrl: 'https://evil.example.com/x/iframe' }),
      item({ id: ID(3), playbackUrl: `http://customer-abc123.cloudflarestream.com/${VIDEO}/iframe` }),
      item({ id: ID(4), thumbnailUrl: `https://customer-abc123.cloudflarestream.com.evil.com/${VIDEO}/thumbnails/thumbnail.jpg` }),
      item({ id: ID(5), thumbnailUrl: 'javascript:alert(1)' }),
      item({ id: ID(6), thumbnailUrl: `${THUMB}?x=1` }),
      item({ id: 'not-an-id' }),
      item({ id: ID(7), title: '' }),
    ];
    expect(THUMBNAIL_URL.test(THUMB)).toBe(true);
    expect(parseRecordings({ items: [...bad, item()] }).map((r) => r.id)).toEqual([ID(1)]);
    expect(parseRecordings({ items: [item({ date: 'yesterday' })] })[0].date).toBeNull();
    expect(parseRecordings({ items: [item({ durationSeconds: -5 })] })[0].durationSeconds).toBe(0);
    expect(parseRecordings('nonsense')).toEqual([]);
  });

  it('reads once from the browser without cookies; 404 is "none", a failure is null', async () => {
    let init: RequestInit | undefined;
    const ok = (async (_url: string, i: RequestInit) => {
      init = i;
      return json({ items: [item()] });
    }) as unknown as typeof fetch;
    expect(await fetchRecordingsInBrowser(ok)).toHaveLength(1);
    expect(init?.credentials).toBe('omit');
    expect(await fetchRecordingsInBrowser((async () => json({}, 404)) as unknown as typeof fetch)).toEqual([]);
    expect(await fetchRecordingsInBrowser((async () => json({}, 503)) as unknown as typeof fetch)).toBeNull();
  });
});

describe('dates and lengths of recordings', () => {
  it('writes the day of the broadcast in Nazareth time with Western digits', () => {
    const lateEvening = Date.parse('2026-10-04T22:30:00Z'); // already 5 October in Nazareth
    expect(formatRecordingDate(lateEvening, 'en')).toBe('October 5, 2026');
    expect(nazarethDay(lateEvening)).toBe('2026-10-05');
    expect(formatRecordingDate(lateEvening, 'ar')).toMatch(/5/);
    expect(formatRecordingDate(lateEvening, 'ar')).not.toMatch(/[٠-٩]/);
  });

  it('writes the length in the language’s own short units', () => {
    expect(formatDuration(45 * 60, 'en')).toBe('45 min');
    expect(formatDuration(3905, 'en')).toBe('1 hr 5 min');
    expect(formatDuration(2 * 3600, 'en')).toBe('2 hr');
    expect(formatDuration(20, 'en')).toBe('1 min');
    expect(formatDuration(3905, 'de')).toBe('1 Std., 5 Min.');
    expect(formatDuration(3905, 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatDuration(0, 'en')).toBeNull();
    expect(isoDuration(3905)).toBe('PT1H5M5S');
    expect(isoDuration(45 * 60)).toBe('PT45M');
    expect(isoDuration(0)).toBe('PT0S');
  });
});

describe('structured data', () => {
  it('a recording is a VideoObject played in Cloudflare’s player', () => {
    const [recording] = parseRecordings({ items: [item()] });
    expect(recordingVideoJsonLd(recording)).toEqual({
      '@type': 'VideoObject',
      name: 'Vespers & rosary',
      uploadDate: '2026-10-04T16:00:00.000Z',
      thumbnailUrl: THUMB,
      embedUrl: PLAYER,
      duration: 'PT1H5M5S',
    });
    expect(recordingVideoJsonLd({ ...recording, date: null, durationSeconds: 0 })).not.toHaveProperty('uploadDate');
  });
  // The announced broadcasts' Events are written once, by the calendar section (lib/broadcastSchedule.ts, its tests).
});

describe('the calendar file of an announced broadcast', () => {
  it('is a timed event in UTC with a stable id, escaped text and the address of the live page', () => {
    const start = Date.parse('2026-10-25T08:00:00Z');
    const ics = buildIcs(
      [
        {
          uid: `live-${ID(1)}@nazarethholycross.com`,
          startsAt: start,
          endsAt: start + 3_600_000,
          summary: 'Vespers, rosary; and more',
          description: 'Line one\nLine two',
          url: 'https://nazarethholycross.com/en/live',
        },
      ],
      { name: 'Live from Nazareth', product: 'Live broadcasts', now: new Date('2026-10-07T12:00:00Z') },
    );
    expect(icsUtc(start)).toBe('20261025T080000Z');
    expect(ics).toContain('PRODID:-//Nazareth Holy Cross//Live broadcasts//EN');
    expect(ics).toContain(`UID:live-${ID(1)}@nazarethholycross.com`);
    expect(ics).toContain('DTSTART:20261025T080000Z');
    expect(ics).toContain('DTEND:20261025T090000Z');
    expect(ics).toContain('SUMMARY:Vespers\\, rosary\\; and more');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two');
    expect(ics).toContain('URL:https://nazarethholycross.com/en/live');
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it('writes no URL that could break a line, and keeps the floating times of the planner', () => {
    const ics = buildIcs(
      [
        { uid: 'x\r\nX-EVIL:1', startsAt: 0, endsAt: 1, summary: 'a', url: 'https://example.com/\r\nX-EVIL:1' },
        { uid: 'plan', date: '2026-11-02', start: 9 * 60, end: 10 * 60, summary: 'b' },
      ],
      { name: 'n', now: new Date(0) },
    );
    expect(ics).not.toContain('X-EVIL:1\r\n');
    expect(ics).not.toMatch(/^URL:/m);
    expect(ics).toContain('PRODID:-//Nazareth Holy Cross//Pilgrimage planner//EN');
    expect(ics).toContain('DTSTART:20261102T090000\r\n');
  });
});

describe('<RecordingList>', () => {
  const withIntl = (ui: React.ReactNode) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Jerusalem">
      <ul>{ui}</ul>
    </NextIntlClientProvider>
  );
  const two = parseRecordings({ items: [item(), item({ id: ID(2), title: 'Morning prayer', date: '2026-09-01T08:00:00Z' })] }).map((r) => recordingView(r, 'en'));

  it('shows each poster under one "Play" button; a press puts that recording’s player in its place, one at a time', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 503))); // the browser read fails: the server's list stays
    render(withIntl(<RecordingList initial={two} />));
    await act(async () => {});
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    const play = screen.getByRole('button', { name: 'Play: Vespers & rosary' });
    const poster = play.querySelector('img');
    expect(poster).toHaveAttribute('alt', '');
    expect(poster).toHaveAttribute('loading', 'lazy');
    expect(poster).toHaveAttribute('src', THUMB);
    expect(screen.getByText('October 4, 2026')).toHaveAttribute('datetime', '2026-10-04');
    expect(screen.getAllByText('1 hr 5 min')[0]).toHaveAttribute('datetime', 'PT1H5M5S');

    fireEvent.click(play);
    const frame = screen.getByTitle('Recording: Vespers & rosary');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('src')).toBe(`${PLAYER}?autoplay=true`);
    expect(frame).toHaveFocus();
    expect(document.querySelectorAll('iframe')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Play: Morning prayer' }));
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Play: Vespers & rosary' })).toBeInTheDocument();
  });

  it('takes the fresh list the browser reads once when the page opens', async () => {
    const fetchMock = vi.fn(async () => json({ items: [item({ id: ID(9), title: 'Just published' })] }));
    vi.stubGlobal('fetch', fetchMock);
    render(withIntl(<RecordingList initial={two} />));
    expect(await screen.findByRole('button', { name: 'Play: Just published' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play: Morning prayer' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
