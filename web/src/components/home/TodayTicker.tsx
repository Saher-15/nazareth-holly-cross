'use client';

import { useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { clockAttribute, formatClock, formatDuration } from './today';

// The two figures of the "Today in Nazareth" strip that follow the clock: the time in Nazareth and the countdown to the
// next broadcast. They change once a minute (never every second: the strip is calm by design, like the /live countdown
// for visitors who asked for less motion), from one shared timer that runs only while one of them is on the page.
// The server's text is kept until the minute changes, so hydration never meets a different string.

const MINUTE = 60_000;
let minute = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function tick() {
  minute = Math.floor(Date.now() / MINUTE);
  listeners.forEach((listener) => listener());
  timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE) + 50);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    minute = Math.floor(Date.now() / MINUTE);
    timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE) + 50);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
      minute = 0; // a clock mounted later reads the time afresh
    }
  };
}

const snapshot = () => minute || Math.floor(Date.now() / MINUTE);

/** The current minute (milliseconds at its start); the server's minute while hydrating. */
function useMinute(serverNow: number): number {
  return useSyncExternalStore(subscribe, snapshot, () => Math.floor(serverNow / MINUTE)) * MINUTE;
}

type ClockProps = { serverNow: number; serverText: string; className?: string };

/** The time in Nazareth, "14:32". */
export function NazarethClock({ serverNow, serverText, className }: ClockProps) {
  const locale = useLocale();
  const now = useMinute(serverNow);
  const fromServer = now === Math.floor(serverNow / MINUTE) * MINUTE;
  return (
    <time className={className} dateTime={clockAttribute(fromServer ? serverNow : now)}>
      {fromServer ? serverText : formatClock(now, locale)}
    </time>
  );
}

type StartsInProps = { startsAt: number; serverNow: number; serverText: string; className?: string };

/** "Starts in 2 days 4 hours"; "Starting soon" once the time has come but the broadcast is not on air yet. */
export function StartsIn({ startsAt, serverNow, serverText, className }: StartsInProps) {
  const t = useTranslations('home.today');
  const locale = useLocale();
  const now = useMinute(serverNow);
  const fromServer = now === Math.floor(serverNow / MINUTE) * MINUTE;
  let text = serverText;
  if (!fromServer) text = startsAt - now >= MINUTE ? t('startsIn', { duration: formatDuration(startsAt - now, locale) }) : t('startingSoon');
  return <span className={className}>{text}</span>;
}
