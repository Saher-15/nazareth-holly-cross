import { locales } from '@/i18n/routing';
import type { LiveOn, LiveStatus } from './liveStatus';

// The "we are live now" window (components/layout/LiveAlert.tsx): the one pop-up the owner approved
// (docs/DESIGN-GUIDE.md sections 1.5 and 5.4). The rules are here, without React, so they can be tested:
//   - only while a broadcast is live, and only on an answer at most a minute old (never on a stale snapshot);
//   - once per broadcast per browser: the broadcast is remembered when the window opens (localStorage
//     `nhc.liveAlert.v1`, validated on read, kept in memory when storage is blocked);
//   - never on the live page itself, and never on a page with a payment step or on the way to one (the cart, the
//     checkout, the candle and the donation forms): a payment is never interrupted;
//   - never in the first seconds on a page (only after 4 s), so it never flashes in while the page loads.

export const LIVE_ALERT_STORAGE_KEY = 'nhc.liveAlert.v1';
/** Time on a page before the window may open. */
export const LIVE_ALERT_DELAY_MS = 4_000;
/** The window opens only on a status read at most this long ago. */
export const LIVE_ALERT_FRESH_MS = 60_000;
/** How many broadcasts are remembered (the oldest are forgotten). */
export const LIVE_ALERT_MAX_SEEN = 20;

/**
 * Pages (paths without the language) where the window never opens: the live page, and every page with a payment step
 * or on the way to one (`/cart` leads to the checkout; checkout, candle and donate show PayPal). Their sub-paths too.
 */
export const LIVE_ALERT_EXCLUDED_PATHS = ['/live', '/cart', '/checkout', '/candle', '/donate'] as const;

const LOCALE_PREFIX = new RegExp(`^/(?:${locales.join('|')})(?=/|$)`);

/** True on a page where the window must not open (`/live`, `/en/checkout`, `/candle/...`). */
export function isLiveAlertExcluded(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0].replace(LOCALE_PREFIX, '').replace(/\/+$/, '') || '/';
  return LIVE_ALERT_EXCLUDED_PATHS.some((excluded) => path === excluded || path.startsWith(`${excluded}/`));
}

/** A short, stable hash of a text (FNV-1a, base 36): enough to tell two titles apart, not to read them back. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** What identifies a broadcast in storage: its session id, or (older API) its start and a hash of its title. */
export function liveAlertKey(status: LiveOn): string {
  return status.id ?? `t${Math.max(0, Math.floor(status.startedAt)).toString(36)}-${shortHash(status.title)}`;
}

const KEY_SHAPE = /^(?:[a-f0-9]{24}|t[a-z0-9]{1,12}-[a-z0-9]{1,8})$/;

/** The remembered broadcasts, from whatever storage holds: anything on the origin can write there. */
export function parseSeen(raw: unknown): string[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const keys = value.filter((key): key is string => typeof key === 'string' && KEY_SHAPE.test(key));
  return [...new Set(keys)].slice(-LIVE_ALERT_MAX_SEEN);
}

// When storage is blocked (some private modes) the window still opens only once per broadcast while the tab lives.
let memory: string[] = [];

export function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(LIVE_ALERT_STORAGE_KEY);
    return raw === null ? [...memory] : parseSeen(raw);
  } catch {
    return [...memory];
  }
}

/** Remembers a broadcast. Returns false when storage is blocked (it is kept in memory then). */
export function markSeen(key: string): boolean {
  const next = [...readSeen().filter((k) => k !== key), key].slice(-LIVE_ALERT_MAX_SEEN);
  memory = next;
  try {
    window.localStorage.setItem(LIVE_ALERT_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/** Forgets the in-memory copy (tests). */
export function resetSeenMemory(): void {
  memory = [];
}

export type LiveAlertCheck = {
  status: LiveStatus;
  /** When the status was read (null: never). */
  checkedAt: number | null;
  now: number;
  /** The page, without the language (`/shop`) or with it (`/en/shop`). */
  pathname: string;
  /** How long the visitor has been on this page. */
  onPageMs: number;
  seen: readonly string[];
};

/** Whether the window should open now (the page itself must also not be busy: see LiveAlert.tsx). */
export function shouldOpenLiveAlert({ status, checkedAt, now, pathname, onPageMs, seen }: LiveAlertCheck): boolean {
  if (!status.live) return false;
  if (isLiveAlertExcluded(pathname)) return false;
  if (onPageMs < LIVE_ALERT_DELAY_MS) return false;
  if (checkedAt === null || Math.abs(now - checkedAt) > LIVE_ALERT_FRESH_MS) return false;
  return !seen.includes(liveAlertKey(status));
}
