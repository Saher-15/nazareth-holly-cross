// The browser's own copy of a broadcast recording, in IndexedDB (docs/LIVE.md "Recordings"): every piece the recorder
// gives is written as it arrives, so a crashed tab, a reload or a dead phone battery does not lose the broadcast. The
// next visit to the Live page offers the unfinished recording for upload.
//
//   database  nhc-live-recordings (version 1)
//   recordings  { localId, sessionId, userId, title, mimeType, startedAt, endedAt, durationSeconds, sizeBytes,
//                 chunkCount, state, recordingId, updatedAt }                          key: localId
//   chunks      { localId, index, blob }                                            key: [localId, index]
//
// What is NOT kept: the one-time upload address (anyone holding it can upload into the account). After a crash the
// upload asks the API for a fresh address and starts from byte 0. The copy is deleted after a successful upload or when
// the admin discards it. Every call can fail (private window, quota, an old browser): callers catch and carry on with
// the copy in memory.

export const RECORDINGS_DB = 'nhc-live-recordings';
export const RECORDINGS_DB_VERSION = 1;
const META = 'recordings';
const CHUNKS = 'chunks';

/** recording -> stopped (the broadcast ended) -> uploading (the API has a recording) -> sent (Cloudflare has every byte). */
export type LocalRecordingState = 'recording' | 'stopped' | 'uploading' | 'sent';

export type LocalRecording = {
  localId: string;
  /** The broadcast (LiveSession id) this recording belongs to. */
  sessionId: string;
  /** Who recorded it: only they (or an owner) are offered the upload. */
  userId: string;
  title: string;
  mimeType: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  sizeBytes: number;
  chunkCount: number;
  state: LocalRecordingState;
  /** The API's recording, once one was created (an upload after a crash renews its address instead). */
  recordingId: string | null;
  updatedAt: number;
};

export interface RecordingStore {
  putMeta(meta: LocalRecording): Promise<void>;
  putChunk(localId: string, index: number, blob: Blob): Promise<void>;
  list(): Promise<LocalRecording[]>;
  get(localId: string): Promise<LocalRecording | null>;
  chunks(localId: string): Promise<Blob[]>;
  remove(localId: string): Promise<void>;
}

type KeyRangeFactory = { bound(lower: unknown, upper: unknown): IDBKeyRange };

const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

const finished = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });

const MAX_INDEX = Number.MAX_SAFE_INTEGER;

/** A store over an open database (exported for the tests, which pass an in-memory fake). */
export function storeOver(db: IDBDatabase, keyRange: KeyRangeFactory): RecordingStore {
  const range = (localId: string) => keyRange.bound([localId, 0], [localId, MAX_INDEX]);
  return {
    async putMeta(meta) {
      const tx = db.transaction([META], 'readwrite');
      tx.objectStore(META).put({ ...meta });
      await finished(tx);
    },
    async putChunk(localId, index, blob) {
      const tx = db.transaction([CHUNKS], 'readwrite');
      tx.objectStore(CHUNKS).put({ localId, index, blob });
      await finished(tx);
    },
    async list() {
      const tx = db.transaction([META], 'readonly');
      const rows = await done(tx.objectStore(META).getAll() as IDBRequest<LocalRecording[]>);
      return rows.filter(isLocalRecording).sort((a, b) => b.startedAt - a.startedAt);
    },
    async get(localId) {
      const tx = db.transaction([META], 'readonly');
      const row = await done(tx.objectStore(META).get(localId) as IDBRequest<LocalRecording | undefined>);
      return row && isLocalRecording(row) ? row : null;
    },
    async chunks(localId) {
      const tx = db.transaction([CHUNKS], 'readonly');
      const rows = await done(tx.objectStore(CHUNKS).getAll(range(localId)) as IDBRequest<{ index: number; blob: Blob }[]>);
      return rows.sort((a, b) => a.index - b.index).map((row) => row.blob);
    },
    async remove(localId) {
      const tx = db.transaction([META, CHUNKS], 'readwrite');
      tx.objectStore(CHUNKS).delete(range(localId));
      tx.objectStore(META).delete(localId);
      await finished(tx);
    },
  };
}

function isLocalRecording(value: unknown): value is LocalRecording {
  const v = value as Partial<LocalRecording> | null;
  return Boolean(v && typeof v.localId === 'string' && typeof v.sessionId === 'string' && typeof v.startedAt === 'number' && typeof v.sizeBytes === 'number');
}

/**
 * Opens (and on first use creates) the database. Resolves null when IndexedDB is missing or refuses (a private window
 * in some browsers, storage turned off): the recording is then kept in memory only.
 */
export async function openRecordingStore(
  factory: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
  keyRange: KeyRangeFactory | undefined = typeof IDBKeyRange === 'undefined' ? undefined : IDBKeyRange,
): Promise<RecordingStore | null> {
  if (!factory || !keyRange) return null;
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(RECORDINGS_DB, RECORDINGS_DB_VERSION);
      request.onupgradeneeded = () => {
        const upgrade = request.result;
        if (!upgrade.objectStoreNames.contains(META)) upgrade.createObjectStore(META, { keyPath: 'localId' });
        if (!upgrade.objectStoreNames.contains(CHUNKS)) upgrade.createObjectStore(CHUNKS, { keyPath: ['localId', 'index'] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB cannot be opened'));
      request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
    });
    return storeOver(db, keyRange);
  } catch {
    return null;
  }
}

/** Asks the browser once to keep this site's storage under pressure (best effort; a refusal changes nothing). */
let persistAsked = false;
export function askPersistentStorage(nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator) {
  if (persistAsked) return;
  persistAsked = true;
  try {
    void nav?.storage?.persist?.().catch(() => undefined);
  } catch {
    // not supported
  }
}

// ---- one tab at a time ----
// The tab that records (and later uploads) a recording holds a Web Lock named after it, so another tab of the same
// browser never offers it as "unfinished" or uploads it twice. The browser releases the lock when the tab dies.

type LockManagerLike = {
  request(name: string, options: { mode?: 'exclusive'; ifAvailable?: boolean }, callback: (lock: unknown) => Promise<unknown>): Promise<unknown>;
  query?(): Promise<{ held?: { name?: string }[] }>;
};

export const lockName = (localId: string) => `nhc-live-recording:${localId}`;

const locksOf = (nav: Navigator | undefined) => (nav as (Navigator & { locks?: LockManagerLike }) | undefined)?.locks;

/** Takes the lock of a recording. Resolves a release function, or null when another tab holds it. */
export async function holdRecordingLock(localId: string, nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator): Promise<(() => void) | null> {
  const locks = locksOf(nav);
  if (!locks) return () => undefined; // no Web Locks: nothing to coordinate with
  let release: () => void = () => undefined;
  const acquired = await new Promise<boolean>((resolve) => {
    locks
      .request(lockName(localId), { mode: 'exclusive', ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return Promise.resolve();
        }
        resolve(true);
        return new Promise<void>((free) => { release = free; });
      })
      .catch(() => resolve(true));
  });
  return acquired ? () => release() : null;
}

/** The recordings another tab of this browser is busy with (their locks are held). */
export async function heldRecordingIds(nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator): Promise<Set<string>> {
  try {
    const state = await locksOf(nav)?.query?.();
    const prefix = lockName('');
    return new Set((state?.held ?? []).map((l) => l.name ?? '').filter((n) => n.startsWith(prefix)).map((n) => n.slice(prefix.length)));
  } catch {
    return new Set();
  }
}
