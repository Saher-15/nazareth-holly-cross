import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveNow from '@/components/community/LiveNow';
import SiteHeader from '@/components/layout/SiteHeader';
import { buildCsp } from '@/lib/csp';
import { fetchLiveStatus, LiveStatusError, nextPollDelay, NOT_LIVE, parseLiveStatus, PLAYER_URL } from '@/lib/liveStatus';
import { livePeekSettled, peekLiveStatus, PEEK_TTL_MS, resetLivePeek } from '@/lib/liveStatusPeek';
import { resetLiveStatusStore } from '@/lib/liveStatusStore';
import en from '@/messages/en.json';
import he from '@/messages/he.json';

// The live broadcast on the public site (docs/LIVE.md): the status the API sends, how the browser polls it, the player
// that appears and disappears, the server's non-blocking peek for the header, and the CSP that allows only Cloudflare's
// player in a frame. No test reaches the network: fetch is replaced in every case.

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
}));

const PLAYER = `https://customer-abc123.cloudflarestream.com/${'f'.repeat(32)}/iframe`;
const LIVE = { live: true, title: 'Evening prayer &amp; vespers', startedAt: '2026-10-06T10:00:00.000Z', playbackUrl: PLAYER };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function withIntl(ui: ReactNode, locale: 'en' | 'he' = 'en') {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : he} timeZone="Asia/Jerusalem">
      {ui}
    </NextIntlClientProvider>
  );
}

beforeEach(() => resetLiveStatusStore());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetLiveStatusStore();
});

describe('the live status (lib/liveStatus.ts)', () => {
  it('reads what the API says, decoding the stored text', () => {
    expect(parseLiveStatus(LIVE)).toEqual({ live: true, title: 'Evening prayer & vespers', startedAt: Date.parse(LIVE.startedAt), playbackUrl: PLAYER });
    expect(parseLiveStatus({ live: false })).toEqual(NOT_LIVE);
  });

  it('keeps the session id of the broadcast when it is 24 hex, and still counts a status without one (an older API)', () => {
    expect(parseLiveStatus({ ...LIVE, id: 'a'.repeat(24) })).toMatchObject({ live: true, id: 'a'.repeat(24) });
    const odd = parseLiveStatus({ ...LIVE, id: '<script>' });
    expect(odd.live).toBe(true);
    expect(odd).not.toHaveProperty('id');
    expect(parseLiveStatus({ ...LIVE, id: 42 })).not.toHaveProperty('id');
  });

  it('frames nothing but a Cloudflare Stream player page: anything else counts as "not live"', () => {
    for (const playbackUrl of [
      'https://evil.example.com/x/iframe',
      `http://customer-abc123.cloudflarestream.com/${'f'.repeat(32)}/iframe`,
      `https://customer-abc123.cloudflarestream.com.evil.com/${'f'.repeat(32)}/iframe`,
      `https://customer-abc123.cloudflarestream.com/${'f'.repeat(32)}/webRTC/play`,
      'javascript:alert(1)',
    ]) {
      expect(PLAYER_URL.test(playbackUrl)).toBe(false);
      expect(parseLiveStatus({ ...LIVE, playbackUrl })).toEqual(NOT_LIVE);
    }
    expect(parseLiveStatus({ ...LIVE, title: '' })).toEqual(NOT_LIVE);
    expect(parseLiveStatus({ ...LIVE, startedAt: 'yesterday' })).toEqual(NOT_LIVE);
    expect(parseLiveStatus(null)).toEqual(NOT_LIVE);
  });

  it('fetches without cookies; a 404 (an API without the route) means "not live"; failures are errors to back off from', async () => {
    const ok = vi.fn(async () => json(LIVE));
    expect((await fetchLiveStatus(undefined, ok as unknown as typeof fetch)).live).toBe(true);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/live\/status$/);
    expect(init.credentials).toBe('omit');
    expect(await fetchLiveStatus(undefined, (async () => json({ error: 'Not found' }, 404)) as unknown as typeof fetch)).toEqual(NOT_LIVE);
    const limited = await fetchLiveStatus(undefined, (async () => json({ error: 'slow down' }, 429, { 'Retry-After': '90' })) as unknown as typeof fetch).catch((e: unknown) => e);
    expect(limited).toBeInstanceOf(LiveStatusError);
    expect((limited as LiveStatusError).retryAfterSeconds).toBe(90);
    const offline = await fetchLiveStatus(undefined, (async () => { throw new TypeError('offline'); }) as unknown as typeof fetch).catch((e: unknown) => e);
    expect((offline as LiveStatusError).status).toBe(0);
  });

  it('polls every 15 seconds, backs off after failures (at most 2 minutes), and honours Retry-After', () => {
    expect(nextPollDelay(0)).toBe(15_000);
    expect(nextPollDelay(1)).toBe(30_000);
    expect(nextPollDelay(2)).toBe(60_000);
    expect(nextPollDelay(9)).toBe(120_000);
    expect(nextPollDelay(1, 300)).toBe(300_000);
    // another base interval (the header's 30 s, the countdown's 10 s)
    expect(nextPollDelay(0, null, 30_000)).toBe(30_000);
    expect(nextPollDelay(1, null, 10_000)).toBe(20_000);
    expect(nextPollDelay(5, null, 30_000)).toBe(120_000);
  });
});

describe('the server peek for the header (lib/liveStatusPeek.ts)', () => {
  beforeEach(() => resetLivePeek());

  it('never waits: "not live" at first, the answer once it came, at most one request per 15 seconds', async () => {
    const fetchImpl = vi.fn(async () => json(LIVE)) as unknown as typeof fetch;
    const t0 = 1_000_000;
    expect(peekLiveStatus(t0, fetchImpl)).toEqual(NOT_LIVE);
    expect(peekLiveStatus(t0 + 10, fetchImpl)).toEqual(NOT_LIVE); // the first read is still on its way: no second one
    await livePeekSettled();
    expect(peekLiveStatus(Date.now(), fetchImpl).live).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    peekLiveStatus(Date.now() + PEEK_TTL_MS + 1, fetchImpl);
    await livePeekSettled();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('a failing API keeps the last answer and is not asked again before the window ends', async () => {
    const good = vi.fn(async () => json(LIVE)) as unknown as typeof fetch;
    peekLiveStatus(0, good);
    await livePeekSettled();
    const bad = vi.fn(async () => { throw new TypeError('down'); }) as unknown as typeof fetch;
    expect(peekLiveStatus(Date.now() + PEEK_TTL_MS + 1, bad).live).toBe(true);
    await livePeekSettled();
    expect(peekLiveStatus(Date.now(), bad).live).toBe(true);
    expect(bad).toHaveBeenCalledTimes(1);
  });
});

describe('<LiveNow> on the /live page', () => {
  let answers: Response[];
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-06T10:12:30.000Z'));
    answers = [];
    fetchMock = vi.fn(async () => answers.shift() ?? json({ live: false }));
    vi.stubGlobal('fetch', fetchMock);
  });

  const flush = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  };

  it('shows nothing while nothing is live, then the player with its title, LIVE and the time on air, then removes it', async () => {
    answers.push(json({ live: false }), json(LIVE), json({ live: false }));
    render(withIntl(<LiveNow initial={NOT_LIVE} checkedAt={null} renderedAt={Date.now()} />));
    await flush();
    expect(screen.queryByTestId('live-now')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    const frame = screen.getByTitle('Live broadcast: Evening prayer & vespers');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('src')).toBe(PLAYER);
    expect(frame.getAttribute('allow')).toContain('fullscreen');
    expect(screen.getByRole('heading', { level: 2, name: 'Evening prayer & vespers' })).toHaveAttribute('dir', 'auto');
    expect(screen.getByText('Live now')).toBeInTheDocument();
    expect(screen.getByText('Live for 12 minutes')).toBeInTheDocument();
    expect(screen.getByTestId('live-now-announcement')).toHaveTextContent('A live broadcast has started: Evening prayer & vespers');

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.queryByTestId('live-now')).toBeNull();
    expect(screen.getByTestId('live-now-announcement')).toHaveTextContent('The live broadcast has ended.');
  });

  it('starts from what the server rendered, without announcing it', async () => {
    answers.push(json(LIVE));
    render(withIntl(<LiveNow initial={parseLiveStatus(LIVE)} checkedAt={null} renderedAt={Date.now()} />));
    expect(screen.getByTestId('live-now-player')).toBeInTheDocument();
    await flush();
    expect(screen.getByTestId('live-now-announcement')).toHaveTextContent('');
  });

  it('waits until the answer of the server is 15 seconds old before asking (a quick visit costs the API nothing)', async () => {
    render(withIntl(<LiveNow initial={NOT_LIVE} checkedAt={Date.now() - 5_000} renderedAt={Date.now()} />));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not poll while the page is hidden, and asks at once when it is shown again', async () => {
    render(withIntl(<LiveNow initial={NOT_LIVE} checkedAt={null} renderedAt={Date.now()} />));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1); // the timer that was already set fires, finds the page hidden, asks nothing
    visibility.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('backs off when the API fails, and stops when the page is left', async () => {
    fetchMock.mockImplementation(async () => json({ error: 'down' }, 503));
    const { unmount } = render(withIntl(<LiveNow initial={NOT_LIVE} checkedAt={null} renderedAt={Date.now()} />));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(29_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1); // the next try waits 30 s, not 15
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reads right to left in Hebrew', async () => {
    render(withIntl(<LiveNow initial={parseLiveStatus(LIVE)} checkedAt={null} renderedAt={Date.now()} />, 'he'));
    expect(screen.getByText(he.communityPage.live.now.badge)).toBeInTheDocument();
    expect(screen.getByTitle(/שידור חי/)).toBeInTheDocument();
  });
});

describe('the "live now" dot in the header', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-06T10:12:30.000Z'));
  });

  it('shows what the server knew at once, with words for screen readers', () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(LIVE)));
    render(withIntl(<SiteHeader live={{ initial: parseLiveStatus(LIVE), checkedAt: Date.now() }} />));
    expect(screen.getByTestId('nav-live-now')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('link', { name: /^Live\s+\(broadcasting now\)$/ })).toHaveAttribute('href', '/live');
  });

  it('appears and disappears without a reload, following the poller of the tab every 30 seconds', async () => {
    const answers = [json(LIVE), json({ live: false })];
    const fetchMock = vi.fn(async () => answers.shift() ?? json({ live: false }));
    vi.stubGlobal('fetch', fetchMock);
    render(withIntl(<SiteHeader live={{ initial: NOT_LIVE, checkedAt: Date.now() }} />));
    expect(screen.queryByTestId('nav-live-now')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(29_000); });
    expect(fetchMock).not.toHaveBeenCalled(); // the server's answer is fresh: nothing asked for 30 s
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('nav-live-now')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('nav-live-now')).toBeNull();
  });
});

describe('Content-Security-Policy for the player and the recordings', () => {
  it('lets the player of Cloudflare Stream into a frame and its posters into images, and nothing else of it', () => {
    const csp = buildCsp({ nonce: 'n', apiOrigin: 'https://api.example.com' });
    const directive = (name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';
    expect(directive('frame-src')).toContain('https://*.cloudflarestream.com');
    expect(directive('img-src')).toContain('https://*.cloudflarestream.com');
    expect(directive('connect-src')).not.toContain('cloudflarestream');
    expect(directive('script-src')).not.toContain('cloudflarestream');
    expect(directive('media-src')).not.toContain('cloudflarestream');
  });
});
