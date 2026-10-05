'use client';

import { useSyncExternalStore } from 'react';

// One shared one-second clock for every component that shows the current time.
let current = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function tick() {
  current = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    current = Date.now();
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  if (current === 0) current = Date.now();
  return current;
}

/**
 * The current time in milliseconds, updated every second. While the server renders and the browser
 * hydrates it is `serverNow`, so the first client render matches the HTML; the real time follows at once.
 */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverNow);
}

const subscribeNever = () => () => {};

/** False on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
