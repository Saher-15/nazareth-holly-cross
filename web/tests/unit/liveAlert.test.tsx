import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveAlert from '@/components/layout/LiveAlert';
import {
  isLiveAlertExcluded,
  LIVE_ALERT_DELAY_MS,
  LIVE_ALERT_EXCLUDED_PATHS,
  LIVE_ALERT_FRESH_MS,
  LIVE_ALERT_STORAGE_KEY,
  liveAlertKey,
  markSeen,
  parseSeen,
  readSeen,
  resetSeenMemory,
  shouldOpenLiveAlert,
} from '@/lib/liveAlert';
import { NOT_LIVE, parseLiveStatus, type LiveOn } from '@/lib/liveStatus';
import { resetLiveStatusStore } from '@/lib/liveStatusStore';
import en from '@/messages/en.json';

// "We are live now" (docs/DESIGN-GUIDE.md 1.5): the rules (lib/liveAlert.ts) and the window itself. jsdom has no
// <dialog> methods, so showModal and close are stood in for; fetch is replaced in every case.

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => nav.pathname,
}));

const PLAYER = `https://customer-abc123.cloudflarestream.com/${'f'.repeat(32)}/iframe`;
const ID = 'c'.repeat(24);
const LIVE = parseLiveStatus({ live: true, id: ID, title: 'Evening prayer', startedAt: '2026-10-06T10:00:00Z', playbackUrl: PLAYER }) as LiveOn;
const OLD_API = parseLiveStatus({ live: true, title: 'Evening prayer', startedAt: '2026-10-06T10:00:00Z', playbackUrl: PLAYER }) as LiveOn;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  resetSeenMemory();
  resetLiveStatusStore();
  nav.pathname = '/';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetLiveStatusStore();
});

describe('the rules of the window', () => {
  const base = { status: LIVE, checkedAt: 1_000_000, now: 1_000_000, pathname: '/', onPageMs: LIVE_ALERT_DELAY_MS, seen: [] as string[] };

  it('opens only while live, on a fresh answer, after 4 seconds on the page, once per broadcast', () => {
    expect(shouldOpenLiveAlert(base)).toBe(true);
    expect(shouldOpenLiveAlert({ ...base, status: NOT_LIVE })).toBe(false);
    expect(shouldOpenLiveAlert({ ...base, onPageMs: LIVE_ALERT_DELAY_MS - 1 })).toBe(false);
    expect(shouldOpenLiveAlert({ ...base, checkedAt: null })).toBe(false);
    expect(shouldOpenLiveAlert({ ...base, now: base.checkedAt + LIVE_ALERT_FRESH_MS + 1 })).toBe(false); // a stale snapshot
    expect(shouldOpenLiveAlert({ ...base, seen: [ID] })).toBe(false);
    expect(shouldOpenLiveAlert({ ...base, seen: ['d'.repeat(24)] })).toBe(true); // a new broadcast
  });

  it('never opens on the live page or a page with a payment step or on the way to one', () => {
    expect([...LIVE_ALERT_EXCLUDED_PATHS].sort()).toEqual(['/candle', '/cart', '/checkout', '/donate', '/live']);
    for (const path of ['/live', '/cart', '/checkout', '/candle', '/donate', '/donate/', '/checkout/step', '/en/checkout', '/he/candle', '/ar/live', '/candle?x=1']) {
      expect(isLiveAlertExcluded(path), path).toBe(true);
      expect(shouldOpenLiveAlert({ ...base, pathname: path }), path).toBe(false);
    }
    for (const path of ['/', '/en', '/shop', '/shop/abc', '/sites/latin', '/livestream', '/candles', '/en/reviews']) {
      expect(isLiveAlertExcluded(path), path).toBe(false);
    }
  });

  it('tells broadcasts apart by session id, or by start and title when an older API sends no id', () => {
    expect(liveAlertKey(LIVE)).toBe(ID);
    const fallback = liveAlertKey(OLD_API);
    expect(fallback).toMatch(/^t[a-z0-9]+-[a-z0-9]+$/);
    expect(liveAlertKey({ ...OLD_API, title: 'Another' })).not.toBe(fallback);
    expect(liveAlertKey({ ...OLD_API, startedAt: OLD_API.startedAt + 1 })).not.toBe(fallback);
    expect(fallback).not.toContain('Evening'); // the title itself is never stored
  });

  it('validates what storage holds: only keys of the expected shape, at most 20, no duplicates', () => {
    expect(parseSeen(JSON.stringify([ID, ID, 'x', 42, '<b>', 't1a2b-3c4d']))).toEqual([ID, 't1a2b-3c4d']);
    expect(parseSeen('{broken')).toEqual([]);
    expect(parseSeen('{"a":1}')).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => i.toString(16).padStart(24, '0'));
    expect(parseSeen(JSON.stringify(many))).toEqual(many.slice(-20));
  });

  it('remembers a broadcast in localStorage, and in memory when storage is blocked', () => {
    expect(markSeen(ID)).toBe(true);
    expect(JSON.parse(localStorage.getItem(LIVE_ALERT_STORAGE_KEY) ?? '[]')).toEqual([ID]);
    expect(readSeen()).toEqual([ID]);

    localStorage.clear();
    resetSeenMemory();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readSeen()).toEqual([]);
    expect(markSeen(ID)).toBe(false);
    expect(readSeen()).toEqual([ID]);
  });
});

describe('<LiveAlert>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-06T10:12:30.000Z'));
    vi.stubGlobal('fetch', vi.fn(async () => json({ live: true, id: ID, title: 'Evening prayer', startedAt: '2026-10-06T10:00:00Z', playbackUrl: PLAYER })));
    // jsdom has no <dialog> methods: open and close it the way a browser does (with the close event).
    Object.assign(HTMLDialogElement.prototype, {
      showModal(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
      close(this: HTMLDialogElement) {
        if (!this.hasAttribute('open')) return;
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    });
  });
  afterEach(() => {
    const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
    delete proto.showModal;
    delete proto.close;
  });

  const renderAlert = (initial = LIVE as ReturnType<typeof parseLiveStatus>) =>
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Jerusalem">
        <button type="button">Before</button>
        <LiveAlert seed={{ initial, checkedAt: Date.now() }} />
      </NextIntlClientProvider>,
    );
  const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  const dialog = () => screen.getByTestId('live-alert') as HTMLDialogElement;

  it('opens after 4 seconds with the broadcast, focuses "Watch now", closes with "Not now" and gives the focus back', async () => {
    renderAlert();
    screen.getByRole('button', { name: 'Before' }).focus();
    await wait(LIVE_ALERT_DELAY_MS - 100);
    expect(dialog().open).toBe(false);
    await wait(100);
    expect(dialog().open).toBe(true);
    expect(dialog()).toHaveAttribute('aria-labelledby', 'live-alert-title');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(en.ux.liveAlert.title);
    expect(screen.getByText('Evening prayer')).toHaveAttribute('dir', 'auto');
    const watch = screen.getByRole('link', { name: en.ux.liveAlert.watch });
    expect(watch).toHaveAttribute('href', '/live');
    expect(watch).toHaveFocus();
    expect(watch.className).toContain('ui-btn--gold');
    expect(readSeen()).toEqual([ID]); // remembered as soon as it is shown

    fireEvent.click(screen.getByRole('button', { name: en.ux.liveAlert.later }));
    expect(dialog().open).toBe(false);
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
  });

  it('closes on a click on the dimmed page around it, not on a click inside it', async () => {
    renderAlert();
    await wait(LIVE_ALERT_DELAY_MS);
    fireEvent.click(screen.getByText(en.ux.liveAlert.text));
    expect(dialog().open).toBe(true);
    fireEvent.click(dialog());
    expect(dialog().open).toBe(false);
  });

  it('opens once per broadcast: not again for the same one, again for a new one', async () => {
    markSeen(ID);
    const { unmount } = renderAlert();
    await wait(LIVE_ALERT_DELAY_MS * 3);
    expect(dialog().open).toBe(false);
    unmount();
    resetLiveStatusStore();
    const next = parseLiveStatus({ live: true, id: 'e'.repeat(24), title: 'Morning prayer', startedAt: '2026-10-06T10:10:00Z', playbackUrl: PLAYER });
    vi.stubGlobal('fetch', vi.fn(async () => json({ ...next, startedAt: '2026-10-06T10:10:00Z' })));
    renderAlert(next);
    await wait(LIVE_ALERT_DELAY_MS);
    expect(dialog().open).toBe(true);
  });

  it('never opens on /live or a payment page', async () => {
    for (const path of ['/live', '/checkout', '/cart', '/candle', '/donate']) {
      nav.pathname = path;
      const { unmount } = renderAlert();
      await wait(LIVE_ALERT_DELAY_MS * 2);
      expect(dialog().open, path).toBe(false);
      unmount();
      resetLiveStatusStore();
    }
    expect(readSeen()).toEqual([]);
  });

  it('waits while the visitor is typing in a field, and opens once they leave it', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Jerusalem">
        <label>
          Name <input />
        </label>
        <LiveAlert seed={{ initial: LIVE, checkedAt: Date.now() }} />
      </NextIntlClientProvider>,
    );
    screen.getByRole('textbox').focus();
    await wait(LIVE_ALERT_DELAY_MS * 3);
    expect(dialog().open).toBe(false);
    screen.getByRole('textbox').blur();
    await wait(2_000);
    expect(dialog().open).toBe(true);
  });

  it('does not open on a snapshot older than a minute until a fresh answer agrees', async () => {
    const fetchMock = vi.fn(async () => json({ live: false }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Jerusalem">
        <LiveAlert seed={{ initial: LIVE, checkedAt: Date.now() - 2 * 60 * 60_000 }} />
      </NextIntlClientProvider>,
    );
    await wait(LIVE_ALERT_DELAY_MS * 2);
    expect(fetchMock).toHaveBeenCalled(); // the old answer was checked at once
    expect(dialog().open).toBe(false);
  });

  it('closes by itself when the broadcast ends while it is open', async () => {
    const fetchMock = vi.fn(async () => json({ live: false }));
    vi.stubGlobal('fetch', fetchMock);
    renderAlert();
    await wait(LIVE_ALERT_DELAY_MS);
    expect(dialog().open).toBe(true);
    await wait(30_000);
    expect(fetchMock).toHaveBeenCalled();
    expect(dialog().open).toBe(false);
  });
});
