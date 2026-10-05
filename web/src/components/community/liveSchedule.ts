// The live page's broadcast schedule and the Live / Upcoming / Offline state computed from it.
//
// Same rules as the CRA page (client/src/components/LiveVideo.js): a broadcast is on air from its start
// time for two hours; otherwise the earliest broadcast still to come is "upcoming"; otherwise the page is
// "offline". One deliberate fix: a broadcast that is on air wins over a later one. The CRA page only looked
// for a broadcast on air when nothing else was scheduled, so with two broadcasts listed it never went live.

/** How long after its start a broadcast counts as on air. */
export const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

export type ScheduledBroadcast = {
  id: string;
  /** Start in Nazareth time, ISO 8601 with the UTC offset of that day (+02:00 winter, +03:00 summer). */
  startsAt: string;
  /** The title, a key under communityPage.live.events in the message files. */
  titleKey: 'annunciationSunday';
};

// To announce a broadcast, add it here (and its title under communityPage.live.events in every language).
export const broadcasts: readonly ScheduledBroadcast[] = [
  { id: 'annunciation-2024-10-06', startsAt: '2024-10-06T09:00:00+03:00', titleKey: 'annunciationSunday' },
];

export type LiveStatus = 'live' | 'upcoming' | 'offline';

export type LiveState<T> = { status: LiveStatus; event: T | null };

/** Which broadcast the player shows at `now` (milliseconds since the epoch), and in which state. */
export function liveState<T extends { start: number }>(events: readonly T[], now: number): LiveState<T> {
  const onAir = events
    .filter((e) => now >= e.start && now <= e.start + LIVE_WINDOW_MS)
    .sort((a, b) => b.start - a.start)[0];
  if (onAir) return { status: 'live', event: onAir };

  const next = events.filter((e) => e.start > now).sort((a, b) => a.start - b.start)[0];
  if (next) return { status: 'upcoming', event: next };

  return { status: 'offline', event: null };
}

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number };

/** Splits a remaining time into whole days, hours, minutes and seconds (never negative). */
export function countdownParts(ms: number): CountdownParts {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}
