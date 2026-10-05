'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Small lists of product ids kept in the browser: the wishlist (hearts) and recently viewed.
// useSyncExternalStore keeps every component — and every open tab — in step.

type ListName = 'wishlist' | 'recent';
const KEYS: Record<ListName, string> = { wishlist: 'nhc.wishlist.v1', recent: 'nhc.recent.v1' };
const LIMITS: Record<ListName, number> = { wishlist: 100, recent: 12 };
const EMPTY: string[] = [];

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: string[] }>();

function read(name: ListName): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEYS[name]);
  } catch {
    return EMPTY;
  }
  const hit = cache.get(name);
  if (hit && hit.raw === raw) return hit.value; // same array while unchanged (required by useSyncExternalStore)
  let value: string[] = EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    value = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, LIMITS[name]) : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache.set(name, { raw, value });
  return value;
}

function write(name: ListName, ids: string[]) {
  try {
    localStorage.setItem(KEYS[name], JSON.stringify(ids.slice(0, LIMITS[name])));
  } catch {
    // storage full or blocked: the list just isn't remembered
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key && Object.values(KEYS).includes(e.key)) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function useList(name: ListName) {
  return useSyncExternalStore(
    subscribe,
    () => read(name),
    () => EMPTY,
  );
}

export function useWishlist() {
  const ids = useList('wishlist');
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => {
    const current = read('wishlist');
    write('wishlist', current.includes(id) ? current.filter((x) => x !== id) : [id, ...current]);
  }, []);
  return { ids, has, toggle };
}

export function useRecentlyViewed() {
  const ids = useList('recent');
  const remember = useCallback((id: string) => {
    const current = read('recent');
    if (current[0] === id) return;
    write('recent', [id, ...current.filter((x) => x !== id)]);
  }, []);
  return { ids, remember };
}
