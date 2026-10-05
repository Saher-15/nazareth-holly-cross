import { describe, expect, it } from 'vitest';
import { broadcasts, countdownParts, LIVE_WINDOW_MS, liveState } from '@/components/community/liveSchedule';

const at = (iso: string) => new Date(iso).getTime();
const sunday = { id: 'sunday', start: at('2024-10-06T09:00:00+03:00') };
const nextSunday = { id: 'next-sunday', start: at('2024-10-13T09:00:00+03:00') };
const minute = 60_000;

describe('liveState (same rules as the CRA LiveVideo.js)', () => {
  it('is offline when nothing is scheduled', () => {
    expect(liveState([], Date.now())).toEqual({ status: 'offline', event: null });
  });

  it('shows the earliest broadcast still to come as upcoming', () => {
    const state = liveState([nextSunday, sunday], sunday.start - 3 * 24 * 60 * minute);
    expect(state).toEqual({ status: 'upcoming', event: sunday });
  });

  it('goes live at the start time and stays live for two hours', () => {
    expect(liveState([sunday], sunday.start).status).toBe('live');
    expect(liveState([sunday], sunday.start + 90 * minute)).toEqual({ status: 'live', event: sunday });
    expect(liveState([sunday], sunday.start + LIVE_WINDOW_MS).status).toBe('live');
  });

  it('is offline once the two hours are over and nothing else is scheduled', () => {
    expect(liveState([sunday], sunday.start + LIVE_WINDOW_MS + 1)).toEqual({ status: 'offline', event: null });
  });

  it('moves on to the next broadcast after one ends', () => {
    expect(liveState([sunday, nextSunday], sunday.start + LIVE_WINDOW_MS + 1)).toEqual({
      status: 'upcoming',
      event: nextSunday,
    });
  });

  // The one deliberate change from the CRA page, which ignored a broadcast on air whenever a later
  // one was listed.
  it('prefers the broadcast on air over a later one', () => {
    expect(liveState([nextSunday, sunday], sunday.start + 30 * minute)).toEqual({ status: 'live', event: sunday });
  });

  it('keeps the schedule in Nazareth time with an explicit UTC offset', () => {
    for (const b of broadcasts) {
      expect(b.startsAt).toMatch(/T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      expect(Number.isNaN(new Date(b.startsAt).getTime())).toBe(false);
    }
  });
});

describe('countdownParts', () => {
  it('splits the remaining time into days, hours, minutes and seconds', () => {
    const ms = ((2 * 24 + 3) * 60 * 60 + 4 * 60 + 5) * 1000 + 999;
    expect(countdownParts(ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it('never goes below zero', () => {
    expect(countdownParts(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
