'use client';

import { useSyncExternalStore } from 'react';

// The prayers this browser has already said "Amen" to. The API counts every like it receives, so the browser keeps
// the ids (localStorage) and offers one Amen per prayer per browser. If storage is blocked the list lives in memory
// for the visit, so the button still works once.

const KEY = 'nhc.prayers.liked.v1';
const MAX_IDS = 500;

const listeners = new Set<() => void>();
let snapshot: string | null = null;
let memory: string[] = [];

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === 'string').slice(-MAX_IDS);
  } catch {
    // storage unavailable or corrupt: fall back to memory below
  }
  return memory;
}

function write(ids: string[]) {
  memory = ids;
  snapshot = JSON.stringify(ids);
  try {
    localStorage.setItem(KEY, snapshot);
  } catch {
    // private mode or a full disk: the in-memory copy keeps this visit consistent
  }
  listeners.forEach((listener) => listener());
}

const onStorage = (event: StorageEvent) => {
  if (event.key === KEY || event.key === null) {
    snapshot = null;
    listeners.forEach((listener) => listener());
  }
};

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): string {
  if (snapshot === null) {
    memory = read();
    snapshot = JSON.stringify(memory);
  }
  return snapshot;
}

/** Whether this browser already liked the prayer. Always false on the server and during hydration. */
export function useHasLiked(id: string): boolean {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => '[]');
  return (JSON.parse(raw) as string[]).includes(id);
}

export function markLiked(id: string) {
  const ids = read();
  if (!ids.includes(id)) write([...ids, id].slice(-MAX_IDS));
}

export function unmarkLiked(id: string) {
  write(read().filter((x) => x !== id));
}
