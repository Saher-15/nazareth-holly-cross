import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDLE_MS, idleVerdict, WARN_BEFORE_MS } from '@/components/shell/IdleGuard';
import { holdSession, onSessionHoldChange, resetSessionHolds, sessionHeld } from '@/lib/session-hold';

// A broadcast or a recording upload holds the session (lib/session-hold.ts): the idle sign-out must not leave the Live
// page during a Mass with the phone on a tripod (leaving ends the broadcast), and the end of the 60-minute sign-in
// must not either; the page reloads once the hold is released (docs/LIVE.md section 5).

afterEach(() => resetSessionHolds());

describe('session holds', () => {
  it('is held while at least one hold is open; releasing twice is harmless; listeners hear every change', () => {
    const listener = vi.fn();
    const stop = onSessionHoldChange(listener);
    expect(sessionHeld()).toBe(false);
    const releaseBroadcast = holdSession();
    const releaseUpload = holdSession();
    expect(sessionHeld()).toBe(true);
    releaseBroadcast();
    releaseBroadcast();
    expect(sessionHeld()).toBe(true);
    releaseUpload();
    expect(sessionHeld()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(4); // two holds, two releases (the repeated release says nothing)
    stop();
  });
});

describe('what the idle guard does at a tick', () => {
  const start = 1_000_000;
  const base = { now: start, expiresAt: start + 60 * 60_000, lastActivity: start, held: false, expiredWhileHeld: false };

  it('as before without a hold: a warning two minutes ahead, then the sign-out; the end of the sign-in signs out', () => {
    expect(idleVerdict({ ...base, now: start + IDLE_MS - WARN_BEFORE_MS - 1 })).toBe('none');
    expect(idleVerdict({ ...base, now: start + IDLE_MS - WARN_BEFORE_MS })).toBe('warn');
    expect(idleVerdict({ ...base, now: start + IDLE_MS })).toBe('signOutIdle');
    expect(idleVerdict({ ...base, now: start + 60 * 60_000, lastActivity: start + 59 * 60_000 })).toBe('signOutExpired');
  });

  it('while broadcasting or uploading: never the idle warning or sign-out, however long nobody touches the page', () => {
    for (const minutes of [29, 31, 45, 59]) {
      expect(idleVerdict({ ...base, held: true, now: start + minutes * 60_000 })).toBe('none');
    }
  });

  it('the sign-in ends while held: the page stays (a notice); released afterwards: it reloads instead of signing out', () => {
    const expired = start + 61 * 60_000;
    expect(idleVerdict({ ...base, held: true, now: expired })).toBe('heldExpired');
    expect(idleVerdict({ ...base, held: false, expiredWhileHeld: true, now: expired + 60_000 })).toBe('reload');
  });
});
