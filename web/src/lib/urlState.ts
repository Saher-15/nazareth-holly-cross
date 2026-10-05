'use client';

import { useSyncExternalStore } from 'react';

// The query string of the current page as React state. Server rendering and the first client render both see
// "" (so they always match); right after hydration the real query string takes over. Writing replaces the
// history entry (no new back-button step, no navigation, no refetch), which keeps a plan or a filter shareable.

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

const getSnapshot = () => window.location.search.replace(/^\?/, '');
const getServerSnapshot = () => '';

/** The current query string without the leading "?". */
export function useQueryString(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Replaces the query string of the current page (an empty string removes it). */
export function replaceQueryString(query: string) {
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', url);
  listeners.forEach((listener) => listener());
}
