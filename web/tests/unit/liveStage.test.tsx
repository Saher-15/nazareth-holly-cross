import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BroadcastStage from '@/components/community/BroadcastStage';
import { broadcastView, type ScheduledBroadcast } from '@/lib/liveSchedule';
import { NOT_LIVE, parseLiveStatus } from '@/lib/liveStatus';
import { liveStatusStore, resetLiveStatusStore } from '@/lib/liveStatusStore';
import ar from '@/messages/ar.json';
import en from '@/messages/en.json';

// The top of /live (BroadcastStage.tsx): the next announced broadcast with its countdown, "Starting soon", the offline
// state, the list of the others and "Add to calendar". fetch is replaced in every case.

const next = en.communityPage.live.next;
const NOW = Date.parse('2026-10-22T07:00:00Z');
const START = NOW + ((2 * 24 + 3) * 60 + 4) * 60_000 + 5_000; // 2 days, 3 hours, 4 minutes, 5 seconds
const PLAYER = `https://customer-abc123.cloudflarestream.com/${'f'.repeat(32)}/iframe`;
const broadcast = (over: Partial<ScheduledBroadcast> = {}): ScheduledBroadcast => ({
  id: 'a'.repeat(24),
  title: 'Sunday Mass',
  description: 'From the Basilica of the Annunciation',
  start: START,
  status: 'scheduled',
  ...over,
});
const LATER = broadcast({ id: 'b'.repeat(24), title: 'Vespers', description: '', start: START + 7 * 86_400_000 });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stage(items: ScheduledBroadcast[], locale: 'en' | 'ar' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Jerusalem">
      <BroadcastStage
        initial={items.map((item) => broadcastView(item, locale))}
        renderedAt={NOW}
        followUrl="https://example.org/follow"
        titleId="live-stage-title"
        background={null}
      />
    </NextIntlClientProvider>,
  );
}
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  resetLiveStatusStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(NOW);
  vi.stubGlobal('fetch', vi.fn(async () => json({}, 503))); // the browser's own read fails: the server's list stays
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetLiveStatusStore();
  document.documentElement.removeAttribute('data-a11y-motion');
});

describe('<BroadcastStage>', () => {
  it('counts down to the next broadcast; screen readers get one sentence, not the seconds', async () => {
    stage([broadcast(), LATER]);
    await wait(0);
    const section = screen.getByTestId('live-stage');
    expect(within(section).getByRole('heading', { level: 2, name: 'Sunday Mass' })).toHaveAttribute('dir', 'auto');
    expect(within(section).getByText(next.kicker)).toBeInTheDocument();
    const timer = screen.getByRole('timer');
    expect(timer).toHaveAttribute('aria-live', 'off');
    expect(timer.querySelector('[aria-hidden="true"]')).toHaveTextContent(/02\s*Days\s*03\s*Hours\s*04\s*Minutes\s*05\s*Seconds/);
    expect(screen.getByTestId('live-countdown-summary')).toHaveTextContent('Starts in 2 days and 3 hours');
    await wait(1_000);
    expect(timer.querySelector('[aria-hidden="true"]')).toHaveTextContent(/04\s*Seconds/);
    expect(screen.getByTestId('live-countdown-summary')).toHaveTextContent('Starts in 2 days and 3 hours');
    // Nazareth time, labelled (the visitor's own line only when their clock differs)
    expect(within(section).getByText(next.nazarethTime)).toBeInTheDocument();
    expect(within(section).getByText('Saturday, October 24, 2026 at 1:04 PM')).toBeInTheDocument();
    expect(within(section).getByText('From the Basilica of the Annunciation')).toBeInTheDocument();
    // the others below, with their own calendar button
    const list = screen.getByTestId('live-upcoming');
    expect(within(list).getByRole('heading', { level: 3, name: 'Vespers' })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: next.addToCalendar })).toHaveAttribute('aria-describedby', `live-upcoming-${'b'.repeat(24)}`);
    expect(screen.getByTestId('live-stage-announcement')).toHaveTextContent('');
  });

  it('shows no seconds to visitors who asked for less motion', async () => {
    document.documentElement.setAttribute('data-a11y-motion', 'reduce');
    stage([broadcast()]);
    await wait(0);
    expect(screen.getByRole('timer')).not.toHaveTextContent(/Seconds?/);
    expect(screen.getByRole('timer')).toHaveTextContent(/Minutes/);
  });

  it('at zero says "Starting soon", announces it once and asks for the live status every 10 seconds for half an hour', async () => {
    const soon = broadcast({ start: NOW + 3_000 });
    stage([soon]);
    await wait(0);
    expect(liveStatusStore().currentInterval()).toBeNull(); // the page's own player (<LiveNow>) asks; the countdown not yet
    await wait(3_000);
    expect(screen.getByTestId('live-starting-soon')).toHaveTextContent(next.soonTitle);
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.getByTestId('live-stage-announcement')).toHaveTextContent(next.startingNow);
    expect(liveStatusStore().currentInterval()).toBe(10_000);
    // half an hour later (the clock jumps; the page's one-second clock then catches up)
    act(() => vi.setSystemTime(soon.start + 30 * 60_000));
    await wait(1_000);
    expect(liveStatusStore().currentInterval()).toBeNull();
    expect(screen.getByTestId('live-stage')).toHaveAttribute('data-status', 'offline');
  });

  it('steps aside while a broadcast is live (the player is above); the announced one is marked live only then', async () => {
    const onAir = broadcast({ start: NOW - 10 * 60_000, status: 'live' });
    liveStatusStore().seed(parseLiveStatus({ live: true, title: 'Sunday Mass', startedAt: new Date(NOW - 600_000).toISOString(), playbackUrl: PLAYER }), NOW);
    const { unmount } = stage([onAir, LATER]);
    await wait(0);
    expect(screen.queryByTestId('live-stage')).toBeNull();
    const list = screen.getByTestId('live-upcoming');
    expect(within(list).getByText(en.communityPage.live.now.badge)).toBeInTheDocument();
    unmount();

    resetLiveStatusStore();
    liveStatusStore().seed(NOT_LIVE, NOW); // the schedule says "live", the status does not: no "Live now"
    stage([onAir, LATER]);
    await wait(0);
    expect(screen.getByTestId('live-stage')).toHaveAttribute('data-status', 'soon');
    expect(screen.queryByText(en.communityPage.live.now.badge)).toBeNull();
  });

  it('shows the offline state when nothing is announced (or the API cannot be reached)', async () => {
    stage([]);
    await wait(0);
    expect(screen.getByRole('heading', { level: 2, name: en.live.no_upcoming_events })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: new RegExp(en.communityPage.live.follow) })).toHaveAttribute('href', 'https://example.org/follow');
    expect(screen.queryByTestId('live-upcoming')).toBeNull();
  });

  it('takes the list the browser reads once when the page opens', async () => {
    const fetchMock = vi.fn(async () => json({ items: [{ id: 'c'.repeat(24), title: 'New &amp; announced', description: '', startsAt: new Date(NOW + 3_600_000).toISOString(), status: 'scheduled' }] }));
    vi.stubGlobal('fetch', fetchMock);
    stage([]);
    await vi.waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'New & announced' })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await wait(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1); // never polled
  });

  it('downloads a calendar file for the broadcast', async () => {
    let saved: Blob | null = null;
    const created = vi.fn((blob: Blob) => {
      saved = blob;
      return 'blob:calendar';
    });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    stage([broadcast()]);
    await wait(0);
    fireEvent.click(within(screen.getByTestId('live-stage')).getByRole('button', { name: next.addToCalendar }));
    expect(click).toHaveBeenCalledTimes(1);
    const text = await (saved as unknown as Blob).text();
    expect(text).toContain('DTSTART:20261024T100405Z');
    expect(text).toContain(`UID:live-${'a'.repeat(24)}@nazarethholycross.com`);
    expect(text).toContain('SUMMARY:Sunday Mass');
    expect(text).toContain('URL:https://nazarethholycross.com/en/live');
  });

  it('reads right to left in Arabic with Western digits', async () => {
    stage([broadcast()], 'ar');
    await wait(0);
    const section = screen.getByTestId('live-stage');
    expect(within(section).getByText(ar.communityPage.live.next.nazarethTime)).toBeInTheDocument();
    expect(section.textContent).not.toMatch(/[٠-٩]/);
    expect(screen.getByTestId('live-countdown-summary').textContent).toContain('يبدأ بعد');
  });
});
