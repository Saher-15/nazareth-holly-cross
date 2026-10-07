// Typed work that must not be lost (review 04 finding 8): a form keeps a copy of what was typed in this tab's
// sessionStorage while it differs from what is saved. When the sign-in ends (idle, 60 minutes, a 401 on save), the
// sign-in page brings the admin back to the same page (`next`, lib/client-api.ts) and the form offers the copy again.
// Only this tab sees it (sessionStorage), it is dropped after a save, a Cancel that was confirmed, a manual sign-out,
// or after 12 hours. Storage may be refused (private mode, quota): then nothing is kept and nothing breaks.

const PREFIX = 'nhc-admin:draft:';
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type Stored<T> = { at: number; value: T };

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, value: T, now = Date.now()): void {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify({ at: now, value } satisfies Stored<T>));
  } catch {
    // full or refused: nothing is kept
  }
}

export function loadDraft<T>(key: string, isValue: (value: unknown) => value is T, now = Date.now()): T | null {
  try {
    const text = storage()?.getItem(PREFIX + key);
    if (!text) return null;
    const stored = JSON.parse(text) as Partial<Stored<unknown>>;
    if (typeof stored.at !== 'number' || now - stored.at > DRAFT_MAX_AGE_MS || !isValue(stored.value)) {
      clearDraft(key);
      return null;
    }
    return stored.value;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // nothing to do
  }
}

/** A manual sign-out: the next person on this tab must not find someone else's half-typed product. */
export function clearAllDrafts(): void {
  const store = storage();
  if (!store) return;
  try {
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) store.removeItem(key);
    }
  } catch {
    // nothing to do
  }
}

// ---- leaving for the sign-in page on purpose (an ended session): a form's "leave the page?" question is not asked
// then, because its draft is kept and comes back after the sign-in.
let leavingForSignIn = false;
export const markLeavingForSignIn = () => {
  leavingForSignIn = true;
};
export const isLeavingForSignIn = () => leavingForSignIn;
