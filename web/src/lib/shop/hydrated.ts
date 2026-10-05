'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while the server renders and during hydration, true afterwards. Lets a view that
 * depends on the browser's storage (wishlist, recently viewed) show a placeholder first
 * instead of a misleading "empty" state.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
