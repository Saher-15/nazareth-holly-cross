import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '@/i18n/messages/en';
import { he } from '@/i18n/messages/he';
import { ar } from '@/i18n/messages/ar';
import { ApiError, recordingSchema, recordingsStateSchema, recordingUploadSchema, scheduledSchema, type Recording } from '@/lib/api';
import { buildCsp } from '@/lib/csp';
import { resolveProxyPath } from '@/lib/proxy-allow';
import {
  BroadcastRecorder, canvasSize, containRect, pickMimeType, prefersMp4, RecorderMixer, uploadMimeType, type MixerDeps, type RecorderCtor,
} from '@/lib/recorder';
import { heldRecordingIds, holdRecordingLock, openRecordingStore, type LocalRecording, type RecordingStore } from '@/lib/recording-store';
import { AlreadyUploaded, RecordingUploadJob, UploadStopped, type RecordingApi } from '@/lib/recording-upload';
import {
  differsFromNazareth, displayStatus, isMissed, matchScheduled, nazarethToUtc, normalizeLocal, scheduleTimeProblem, utcToNazarethLocal,
} from '@/lib/schedule';
import { backoffMs, checkUploadUrl, crossedMilestone, normalChunkSize, TUS_CHUNK_BYTES, TusError, TusUpload, type XhrLike } from '@/lib/tus';
import { proxy } from '@/proxy';

// Recordings and scheduled broadcasts on the Live page (docs/LIVE.md): the recorder's choices, the IndexedDB copy against
// an in-memory IndexedDB, the tus upload loop against a fake Cloudflare, the upload job against a fake API, the Nazareth
// time rules, and the page's security rules (CSP, proxy allow-list).

// ============================================================================ an in-memory IndexedDB (what the store uses)

type Key = string | number | (string | number)[];
const cmp = (a: Key, b: Key): number => {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      const c = cmp(a[i], b[i]);
      if (c) return c;
    }
    return a.length - b.length;
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'number') return -1; // numbers sort before strings in IndexedDB
  if (typeof b === 'number') return 1;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
};
type Range = { lower: Key; upper: Key; includes(key: Key): boolean };
const fakeKeyRange = { bound: (lower: Key, upper: Key): Range => ({ lower, upper, includes: (k) => cmp(k, lower) >= 0 && cmp(k, upper) <= 0 }) };

class FakeRequest<T = unknown> {
  result: T | undefined;
  error: Error | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: (() => void) | null = null;
  onblocked: (() => void) | null = null;
}

class FakeDb {
  stores = new Map<string, { keyPath: string | string[]; rows: Map<string, { key: Key; value: unknown }> }>();
  /** Writes after this many succeed are refused like a full disk (QuotaExceededError). */
  quotaAfter = Infinity;
  writes = 0;
  objectStoreNames = { contains: (name: string) => this.stores.has(name) };
  createObjectStore(name: string, { keyPath }: { keyPath: string | string[] }) {
    this.stores.set(name, { keyPath, rows: new Map() });
  }
  transaction(names: string[]) {
    const tx = {
      error: null as Error | null,
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      failed: false,
      objectStore: (name: string) => this.store(name, tx),
    };
    for (const name of names) if (!this.stores.has(name)) throw new Error(`no store ${name}`);
    setTimeout(() => (tx.failed ? tx.onerror?.() : tx.oncomplete?.()), 0);
    return tx;
  }
  private store(name: string, tx: { failed: boolean; error: Error | null }) {
    const s = this.stores.get(name)!;
    const keyOf = (value: Record<string, unknown>): Key => (Array.isArray(s.keyPath) ? s.keyPath.map((k) => value[k] as string | number) : (value[s.keyPath] as Key));
    const answer = <T>(result: T) => {
      const request = new FakeRequest<T>();
      request.result = result;
      queueMicrotask(() => request.onsuccess?.());
      return request;
    };
    const sorted = () => [...s.rows.values()].sort((a, b) => cmp(a.key, b.key));
    return {
      put: (value: Record<string, unknown>) => {
        this.writes += 1;
        if (this.writes > this.quotaAfter) {
          tx.failed = true;
          tx.error = new DOMException('full', 'QuotaExceededError');
          return answer(undefined);
        }
        const key = keyOf(value);
        s.rows.set(JSON.stringify(key), { key, value: structuredClone(value) });
        return answer(key);
      },
      get: (key: Key) => answer(s.rows.get(JSON.stringify(key))?.value),
      getAll: (range?: Range) => answer(sorted().filter((r) => !range || range.includes(r.key)).map((r) => r.value)),
      delete: (keyOrRange: Key | Range) => {
        for (const [k, r] of s.rows) if (typeof keyOrRange === 'object' && !Array.isArray(keyOrRange) ? keyOrRange.includes(r.key) : JSON.stringify(r.key) === JSON.stringify(keyOrRange)) s.rows.delete(k);
        return answer(undefined);
      },
    };
  }
}

function fakeIndexedDb({ refuse = false } = {}) {
  const dbs = new Map<string, FakeDb>();
  const factory = {
    dbs,
    open(name: string) {
      const request = new FakeRequest<FakeDb>();
      queueMicrotask(() => {
        if (refuse) {
          request.error = new DOMException('no', 'SecurityError');
          request.onerror?.();
          return;
        }
        let db = dbs.get(name);
        if (!db) {
          db = new FakeDb();
          dbs.set(name, db);
          request.result = db;
          request.onupgradeneeded?.();
        }
        request.result = db;
        request.onsuccess?.();
      });
      return request;
    },
  };
  return factory;
}

const openFake = async (factory = fakeIndexedDb()) => ({ factory, store: (await openRecordingStore(factory as unknown as IDBFactory, fakeKeyRange as unknown as typeof IDBKeyRange))! });

const blobOf = (text: string, type = 'video/webm') => new Blob([text], { type });
const textOf = async (blobs: Blob[]) => Promise.all(blobs.map((b) => b.text()));

const localRecording = (over: Partial<LocalRecording> = {}): LocalRecording => ({
  localId: 'L1', sessionId: 'a'.repeat(24), userId: 'u1', title: 'Vespers', mimeType: 'video/webm', startedAt: 1000, endedAt: 61_000,
  durationSeconds: 60, sizeBytes: 3, chunkCount: 1, state: 'stopped', recordingId: null, updatedAt: 61_000, ...over,
});

describe('the IndexedDB copy (lib/recording-store.ts)', () => {
  it('creates the two stores once, keeps pieces in order per recording and deletes only that recording', async () => {
    const { factory, store } = await openFake();
    const db = factory.dbs.get('nhc-live-recordings')!;
    expect([...db.stores.keys()]).toEqual(['recordings', 'chunks']);
    expect(db.stores.get('chunks')!.keyPath).toEqual(['localId', 'index']);

    await store.putMeta(localRecording({ localId: 'A', startedAt: 1 }));
    await store.putMeta(localRecording({ localId: 'B', startedAt: 2 }));
    // written out of order, across two recordings; index 10 must come after 2 (numbers, not text)
    for (const [id, index, text] of [['A', 10, 'a10'], ['A', 0, 'a0'], ['B', 0, 'b0'], ['A', 2, 'a2']] as const) await store.putChunk(id, index, blobOf(text));
    expect(await textOf(await store.chunks('A'))).toEqual(['a0', 'a2', 'a10']);
    expect((await store.list()).map((r) => r.localId)).toEqual(['B', 'A']); // newest first
    expect((await store.get('A'))?.title).toBe('Vespers');

    await store.remove('A');
    expect(await store.chunks('A')).toEqual([]);
    expect(await textOf(await store.chunks('B'))).toEqual(['b0']);
    expect((await store.list()).map((r) => r.localId)).toEqual(['B']);

    // opening again keeps the data (no second upgrade)
    const again = await openRecordingStore(factory as unknown as IDBFactory, fakeKeyRange as unknown as typeof IDBKeyRange);
    expect((await again!.list()).map((r) => r.localId)).toEqual(['B']);
  });

  it('is null (memory only) when IndexedDB is missing or refuses', async () => {
    expect(await openRecordingStore(undefined, undefined)).toBeNull();
    expect(await openRecordingStore(fakeIndexedDb({ refuse: true }) as unknown as IDBFactory, fakeKeyRange as unknown as typeof IDBKeyRange)).toBeNull();
  });

  it('never stores an upload address: only the recording id', async () => {
    const { factory, store } = await openFake();
    await store.putMeta(localRecording({ recordingId: 'b'.repeat(24) }));
    const rows = JSON.stringify([...factory.dbs.get('nhc-live-recordings')!.stores.get('recordings')!.rows.values()]);
    expect(rows).toContain('b'.repeat(24));
    expect(rows).not.toMatch(/upload\.|https?:/);
  });

  it('one tab at a time: a held lock hides the recording from other tabs', async () => {
    const held = new Set<string>();
    const locks = {
      async request(name: string, options: { ifAvailable?: boolean }, cb: (lock: unknown) => Promise<unknown>) {
        if (held.has(name)) return cb(null);
        held.add(name);
        await cb({ name });
        held.delete(name);
        return undefined;
      },
      async query() { return { held: [...held].map((name) => ({ name })) }; },
    };
    const nav = { locks } as unknown as Navigator;
    const release = await holdRecordingLock('L1', nav);
    expect(release).toBeTypeOf('function');
    expect([...(await heldRecordingIds(nav))]).toEqual(['L1']);
    expect(await holdRecordingLock('L1', nav)).toBeNull(); // a second tab cannot take it
    release!();
    await vi.waitFor(async () => expect((await heldRecordingIds(nav)).size).toBe(0));
    // no Web Locks at all: nothing to coordinate with
    expect(await holdRecordingLock('L2', {} as Navigator)).toBeTypeOf('function');
    expect((await heldRecordingIds({} as Navigator)).size).toBe(0);
  });
});

// ============================================================================ the recorder

describe('choosing what to record (lib/recorder.ts)', () => {
  const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
  const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const EDGE = `${CHROME} Edg/130.0`;
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

  it('prefers mp4 on WebKit (Safari, every iPhone browser) and webm elsewhere', () => {
    expect(prefersMp4(SAFARI)).toBe(true);
    expect(prefersMp4(IPHONE_CHROME)).toBe(true);
    expect(prefersMp4(CHROME)).toBe(false);
    expect(prefersMp4(EDGE)).toBe(false);
    expect(prefersMp4(ANDROID)).toBe(false);
  });

  it('takes the first type the browser supports, in that order', () => {
    const all = () => true;
    expect(pickMimeType(all, true)).toBe('video/mp4;codecs=avc1,mp4a.40.2');
    expect(pickMimeType(all, false)).toBe('video/webm;codecs=vp9,opus');
    expect(pickMimeType((t) => t !== 'video/webm;codecs=vp9,opus' && t.startsWith('video/webm'), false)).toBe('video/webm;codecs=vp8,opus');
    expect(pickMimeType((t) => t === 'video/webm', true)).toBe('video/webm'); // Safari without mp4: webm after all
    expect(pickMimeType((t) => t === 'video/mp4', false)).toBe('video/mp4'); // a browser with mp4 only
    expect(pickMimeType(() => false, false)).toBe('');
    expect(pickMimeType(undefined, false)).toBe('');
    expect(pickMimeType((t) => { if (t.includes('vp9')) throw new Error('x'); return true; }, false)).toBe('video/webm;codecs=vp8,opus');
  });

  it('tells the API a type it accepts', () => {
    expect(uploadMimeType('video/webm;codecs=vp9,opus', 'video/webm')).toBe('video/webm;codecs=vp9,opus');
    expect(uploadMimeType('video/x-matroska;codecs=avc1,opus', 'video/webm')).toBe('video/x-matroska;codecs=avc1,opus');
    expect(uploadMimeType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"', '')).toBe('video/mp4;codecs="avc1.42E01E,mp4a.40.2"');
    expect(uploadMimeType('', 'video/mp4;codecs=avc1,mp4a.40.2')).toBe('video/mp4;codecs=avc1,mp4a.40.2');
    expect(uploadMimeType('video/webm;codecs=<script>', '')).toBe('video/webm');
    expect(uploadMimeType(undefined, '')).toBe('video/webm');
  });

  it('sizes the canvas to the camera, at most 1280 x 720 (or 720 x 1280 upright), even numbers', () => {
    expect(canvasSize(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(canvasSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
    expect(canvasSize(720, 1280)).toEqual({ width: 720, height: 1280 });
    expect(canvasSize(640, 480)).toEqual({ width: 640, height: 480 });
    expect(canvasSize(4032, 3024)).toEqual({ width: 960, height: 720 });
    expect(canvasSize(641, 361)).toEqual({ width: 642, height: 362 });
    expect(canvasSize()).toEqual({ width: 1280, height: 720 });
  });

  it('fits a switched or turned camera into the fixed canvas, whole and centred', () => {
    expect(containRect({ width: 1280, height: 720 }, { width: 1280, height: 720 })).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    expect(containRect({ width: 720, height: 1280 }, { width: 1280, height: 720 })).toEqual({ x: 437.5, y: 0, width: 405, height: 720 });
    expect(containRect({ width: 0, height: 0 }, { width: 10, height: 10 })).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});

// ---- fakes for the mixer: a canvas, WebAudio and tracks
const fakeTrack = (kind: 'audio' | 'video', settings: MediaTrackSettings = {}) => ({ kind, id: `${kind}-${Math.random()}`, enabled: true, readyState: 'live', stop: vi.fn(), getSettings: () => settings }) as unknown as MediaStreamTrack;
class FakeStream {
  tracks: MediaStreamTrack[];
  constructor(tracks: MediaStreamTrack[] = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
}
function fakeAudio() {
  const sources: { track: MediaStreamTrack; connected: boolean; disconnect: () => void; connect: () => void }[] = [];
  const gain = { gain: { value: 1 }, connect: vi.fn() };
  const destinationTrack = fakeTrack('audio');
  class Ctx {
    static made = 0;
    closed = false;
    constructor() { Ctx.made += 1; }
    createMediaStreamDestination() { return { stream: new FakeStream([destinationTrack]) }; }
    createGain() { return gain; }
    createMediaStreamSource(stream: FakeStream) {
      const source = { track: stream.getAudioTracks()[0], connected: false, connect() { this.connected = true; }, disconnect() { this.connected = false; } };
      sources.push(source);
      return source;
    }
    resume() { return Promise.resolve(); }
    close() { this.closed = true; return Promise.resolve(); }
  }
  return { Ctx, sources, gain, destinationTrack };
}
const asCanvas = (canvas: unknown) => () => canvas as ReturnType<NonNullable<MixerDeps['createCanvas']>>;
function fakeCanvas(capture = true) {
  const drawn: number[][] = [];
  const canvasTrack = fakeTrack('video');
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ fillStyle: '', fillRect: vi.fn(), drawImage: (_v: unknown, x: number, y: number, w: number, h: number) => drawn.push([x, y, w, h]) }),
    ...(capture ? { captureStream: vi.fn(() => new FakeStream([canvasTrack])) } : {}),
  };
  return { canvas, drawn, canvasTrack };
}

describe('the recorder mixer survives a camera or microphone switch', () => {
  const video = (w = 1280, h = 720) => {
    const callbacks: (() => void)[] = [];
    return { el: { videoWidth: w, videoHeight: h, readyState: 4, requestVideoFrameCallback: (cb: () => void) => { callbacks.push(cb); return callbacks.length; }, cancelVideoFrameCallback: vi.fn() }, callbacks };
  };
  const timers = () => ({ setInterval: vi.fn(() => 1), clearInterval: vi.fn(), now: () => 0 });

  it('records the canvas and a WebAudio track: a new microphone is reconnected, the recorded tracks stay', () => {
    const v = video();
    const { canvas, drawn, canvasTrack } = fakeCanvas();
    const audio = fakeAudio();
    const mic1 = fakeTrack('audio');
    const source = new FakeStream([fakeTrack('video', { width: 1920, height: 1080 }), mic1]) as unknown as MediaStream;
    const mixer = new RecorderMixer(v.el, source, { createCanvas: asCanvas(canvas), AudioContextCtor: audio.Ctx as unknown as new () => AudioContext, MediaStreamCtor: FakeStream as unknown as new (t?: MediaStreamTrack[]) => MediaStream, ...timers() });

    expect(mixer.mode).toEqual({ video: 'canvas', audio: 'webaudio' });
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(mixer.stream.getTracks()).toEqual([canvasTrack, audio.destinationTrack]);
    expect(audio.sources[0].track).toBe(mic1);
    expect(audio.sources[0].connected).toBe(true);

    // frames follow the preview element
    v.callbacks.shift()!();
    expect(drawn.at(-1)).toEqual([0, 0, 1280, 720]);
    expect(v.callbacks).toHaveLength(1);

    // the microphone changes: the old source is disconnected, the new one connected; the recorded tracks are the same
    const mic2 = fakeTrack('audio');
    mixer.setSource(new FakeStream([fakeTrack('video'), mic2]) as unknown as MediaStream);
    expect(audio.sources[0].connected).toBe(false);
    expect(audio.sources[1].track).toBe(mic2);
    expect(audio.sources[1].connected).toBe(true);
    expect(mixer.stream.getTracks()).toEqual([canvasTrack, audio.destinationTrack]);

    // a camera turned upright is fitted into the same canvas
    v.el.videoWidth = 720;
    v.el.videoHeight = 1280;
    v.callbacks.shift()!();
    expect(drawn.at(-1)).toEqual([437.5, 0, 405, 720]);

    // mute records silence
    mixer.setMuted(true);
    expect(audio.gain.gain.value).toBe(0);
    mixer.setMuted(false);
    expect(audio.gain.gain.value).toBe(1);

    mixer.dispose();
    expect(canvasTrack.stop).toHaveBeenCalled();
    mixer.dispose(); // twice is harmless
  });

  it('falls back to the raw tracks when the browser has no canvas capture or WebAudio', () => {
    const cam = fakeTrack('video');
    const mic = fakeTrack('audio');
    const { canvas } = fakeCanvas(false);
    const mixer = new RecorderMixer(video().el, new FakeStream([cam, mic]) as unknown as MediaStream, { createCanvas: asCanvas(canvas), AudioContextCtor: undefined, MediaStreamCtor: FakeStream as unknown as new (t?: MediaStreamTrack[]) => MediaStream, ...timers() });
    expect(mixer.mode).toEqual({ video: 'direct', audio: 'direct' });
    expect(mixer.stream.getTracks()).toEqual([cam, mic]);
    mixer.dispose();
    expect(cam.stop).not.toHaveBeenCalled(); // the camera belongs to the studio
  });

  it('without a microphone, WebAudio still gives the file a (silent) sound track', () => {
    const audio = fakeAudio();
    const { canvas } = fakeCanvas();
    const mixer = new RecorderMixer(video().el, new FakeStream([fakeTrack('video')]) as unknown as MediaStream, { createCanvas: asCanvas(canvas), AudioContextCtor: audio.Ctx as unknown as new () => AudioContext, MediaStreamCtor: FakeStream as unknown as new (t?: MediaStreamTrack[]) => MediaStream, ...timers() });
    expect(mixer.mode.audio).toBe('webaudio');
    expect(mixer.stream.getAudioTracks()).toEqual([audio.destinationTrack]);
    expect(audio.sources).toHaveLength(0);
  });
});

// ---- a fake MediaRecorder: pieces are pushed by the test
class FakeRecorder {
  static last: FakeRecorder;
  static supported = true;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  options?: MediaRecorderOptions;
  timeslice?: number;
  private listeners: Record<string, ((e: { data: Blob }) => void)[]> = {};
  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.options = options;
    this.mimeType = options?.mimeType ?? 'video/webm';
    FakeRecorder.last = this;
  }
  addEventListener(type: string, listener: (e: { data: Blob }) => void) { (this.listeners[type] ??= []).push(listener); }
  emit(type: string, data?: Blob) { for (const l of this.listeners[type] ?? []) l({ data: data as Blob }); }
  start(timeslice?: number) { this.state = 'recording'; this.timeslice = timeslice; }
  stop() { this.state = 'inactive'; setTimeout(() => { this.emit('dataavailable', blobOf('END')); this.emit('stop'); }, 1); }
}

describe('the broadcast recorder keeps every piece in memory and in IndexedDB', () => {
  const start = async (store: RecordingStore | null) => {
    let clock = 10_000;
    const rec = new BroadcastRecorder({
      stream: new FakeStream() as unknown as MediaStream,
      mimeType: 'video/webm;codecs=vp9,opus',
      meta: { localId: 'R1', sessionId: 'c'.repeat(24), userId: 'u1', title: 'Feast' },
      store,
      RecorderCtor: FakeRecorder as unknown as RecorderCtor,
      now: () => clock,
    });
    rec.start();
    return { rec, recorder: FakeRecorder.last, tick: (ms: number) => { clock += ms; } };
  };

  it('records with a timeslice and the bitrates, writes pieces in order and returns the whole file', async () => {
    const { store } = await openFake();
    const { rec, recorder, tick } = await start(store);
    expect(recorder.timeslice).toBe(4000);
    expect(recorder.options).toMatchObject({ mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
    tick(4000);
    recorder.emit('dataavailable', blobOf('one'));
    recorder.emit('dataavailable', new Blob([])); // an empty piece is ignored
    tick(4000);
    recorder.emit('dataavailable', blobOf('two'));
    expect(rec.sizeBytes).toBe(6);
    await vi.waitFor(async () => expect(await textOf(await store.chunks('R1'))).toEqual(['one', 'two']));
    const saved = await store.get('R1');
    expect(saved).toMatchObject({ state: 'recording', chunkCount: 2, sizeBytes: 6, durationSeconds: 8, sessionId: 'c'.repeat(24), mimeType: 'video/webm;codecs=vp9,opus' });

    tick(2000);
    const file = await rec.stop();
    expect(await file.text()).toBe('onetwoEND');
    expect(file.type).toBe('video/webm;codecs=vp9,opus');
    expect(await store.get('R1')).toMatchObject({ state: 'stopped', chunkCount: 3, sizeBytes: 9, durationSeconds: 10 });
    expect(await textOf(await store.chunks('R1'))).toEqual(['one', 'two', 'END']);
    expect(await rec.stop()).toBeInstanceOf(Blob); // twice is harmless
  });

  it('a full disk stops the copy (a whole prefix stays) but never the recording', async () => {
    const { factory, store } = await openFake();
    const { rec, recorder } = await start(store);
    await vi.waitFor(async () => expect(await store.get('R1')).not.toBeNull());
    factory.dbs.get('nhc-live-recordings')!.quotaAfter = factory.dbs.get('nhc-live-recordings')!.writes + 2; // piece 1 and its meta fit
    recorder.emit('dataavailable', blobOf('one'));
    recorder.emit('dataavailable', blobOf('two'));
    recorder.emit('dataavailable', blobOf('three'));
    await vi.waitFor(() => expect(rec.persisted).toBe(false));
    expect(await (await rec.stop()).text()).toBe('onetwothreeEND');
    expect(await textOf(await store.chunks('R1'))).toEqual(['one']);
  });

  it('without IndexedDB it records in memory only', async () => {
    const { rec, recorder } = await start(null);
    expect(rec.persisted).toBe(false);
    recorder.emit('dataavailable', blobOf('x'));
    expect(await (await rec.stop()).text()).toBe('xEND');
  });
});

// ============================================================================ tus

/** A fake Cloudflare tus endpoint behind a fake XMLHttpRequest. `script` can override an answer by call number. */
function fakeCloudflareTus({ script = {} as Record<number, 'network' | { status: number; offset?: number; accept?: boolean }> } = {}) {
  const received = new Map<string, number>(); // address -> bytes
  const calls: { method: string; url: string; headers: Record<string, string>; size: number; withCredentials: boolean }[] = [];
  const progress: number[] = [];
  class Xhr implements XhrLike {
    status = 0;
    timeout = 0;
    withCredentials = true;
    upload = { onprogress: null as ((e: { loaded: number }) => void) | null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    private method = '';
    private url = '';
    private headers: Record<string, string> = {};
    private responseHeaders: Record<string, string> = {};
    open(method: string, url: string) { this.method = method; this.url = url; }
    setRequestHeader(name: string, value: string) { this.headers[name] = value; }
    getResponseHeader(name: string) { return this.responseHeaders[name] ?? null; }
    abort() { queueMicrotask(() => this.onabort?.()); }
    send(body?: Blob | null) {
      calls.push({ method: this.method, url: this.url, headers: { ...this.headers }, size: body?.size ?? 0, withCredentials: this.withCredentials });
      const n = calls.length;
      setTimeout(() => {
        const forced = script[n];
        if (forced === 'network') return this.onerror?.();
        const have = received.get(this.url) ?? 0;
        if (forced && forced.accept) received.set(this.url, have + (body?.size ?? 0)); // Cloudflare got it; the answer is lost
        if (forced) {
          this.status = forced.status;
          if (forced.offset !== undefined) this.responseHeaders['Upload-Offset'] = String(forced.offset);
          return this.onload?.();
        }
        if (this.method === 'HEAD') {
          this.status = 200;
          this.responseHeaders['Upload-Offset'] = String(have);
          return this.onload?.();
        }
        if (Number(this.headers['Upload-Offset']) !== have) { this.status = 409; return this.onload?.(); }
        this.upload.onprogress?.({ loaded: Math.floor((body?.size ?? 0) / 2) });
        received.set(this.url, have + (body?.size ?? 0));
        this.status = 204;
        this.responseHeaders['Upload-Offset'] = String(have + (body?.size ?? 0));
        this.onload?.();
      }, 0);
    }
  }
  return { received, calls, progress, createXhr: () => new Xhr() };
}

const MiB = 1024 * 1024;
const bigBlob = (bytes: number) => new Blob([new Uint8Array(bytes)]);
const ADDRESS = 'https://upload.videodelivery.net/tus/0123456789abcdef0123456789abcdef?tusv2=true';
const ADDRESS2 = 'https://upload.videodelivery.net/tus/fedcba9876543210fedcba9876543210?tusv2=true';

describe('the tus upload (lib/tus.ts)', () => {
  it('sends 8 MiB pieces (multiples of 256 KiB, at least 5 MiB) at the offsets Cloudflare confirms, without cookies', async () => {
    const cf = fakeCloudflareTus();
    const blob = bigBlob(17 * MiB + 100);
    const seen: number[] = [];
    const upload = new TusUpload({ blob, url: ADDRESS, renew: vi.fn(), createXhr: cf.createXhr, wait: async () => undefined, onProgress: (sent) => seen.push(sent) });
    await upload.run();
    expect(cf.received.get(ADDRESS)).toBe(blob.size);
    expect(cf.calls.map((c) => [c.method, c.headers['Upload-Offset'], c.size])).toEqual([
      ['PATCH', '0', 8 * MiB], ['PATCH', String(8 * MiB), 8 * MiB], ['PATCH', String(16 * MiB), MiB + 100],
    ]);
    for (const call of cf.calls) {
      expect(call.headers['Tus-Resumable']).toBe('1.0.0');
      expect(call.headers['Content-Type']).toBe('application/offset+octet-stream');
      expect(call.withCredentials).toBe(false);
    }
    expect(TUS_CHUNK_BYTES % (256 * 1024)).toBe(0);
    expect(seen.at(-1)).toBe(blob.size);
    expect(seen).toContain(4 * MiB); // progress inside a piece
    expect([...seen].sort((a, b) => a - b)).toEqual(seen); // never backwards
  });

  it('piece sizes are always multiples of 256 KiB and at least 5 MiB', () => {
    expect(normalChunkSize(1)).toBe(5 * MiB);
    expect(normalChunkSize(8 * MiB + 1000)).toBe(8 * MiB);
    expect(normalChunkSize(50 * MiB)).toBe(50 * MiB);
    for (const n of [1, 5 * MiB + 1, 7 * MiB, 64 * MiB + 3]) expect(normalChunkSize(n) % (256 * 1024)).toBe(0);
  });

  it('after a network failure it waits, asks Cloudflare how much it has (HEAD) and goes on from there', async () => {
    const cf = fakeCloudflareTus({ script: { 2: 'network' } });
    const waits: number[] = [];
    const upload = new TusUpload({ blob: bigBlob(12 * MiB), url: ADDRESS, renew: vi.fn(), createXhr: cf.createXhr, wait: async (ms) => { waits.push(ms); } });
    await upload.run();
    expect(cf.calls.map((c) => [c.method, c.headers['Upload-Offset'] ?? '-'])).toEqual([['PATCH', '0'], ['PATCH', String(8 * MiB)], ['HEAD', '-'], ['PATCH', String(8 * MiB)]]);
    expect(waits).toEqual([2000]);
    expect(cf.received.get(ADDRESS)).toBe(12 * MiB);
  });

  it("a lost answer (Cloudflare got the piece, we did not hear it) is resumed from Cloudflare's offset, not ours", async () => {
    const cf = fakeCloudflareTus({ script: { 1: { status: 502, accept: true } } });
    const upload = new TusUpload({ blob: bigBlob(10 * MiB), url: ADDRESS, renew: vi.fn(), createXhr: cf.createXhr, wait: async () => undefined });
    await upload.run();
    expect(cf.calls.map((c) => [c.method, c.headers['Upload-Offset'] ?? '-'])).toEqual([['PATCH', '0'], ['HEAD', '-'], ['PATCH', String(8 * MiB)]]);
    expect(cf.received.get(ADDRESS)).toBe(10 * MiB);
  });

  it('an expired address (404/410) is renewed and the upload starts again from byte 0', async () => {
    const cf = fakeCloudflareTus({ script: { 2: { status: 410 } } });
    const renew = vi.fn(async () => ADDRESS2);
    const seen: number[] = [];
    const upload = new TusUpload({ blob: bigBlob(10 * MiB), url: ADDRESS, renew, createXhr: cf.createXhr, wait: async () => undefined, onProgress: (s) => seen.push(s) });
    await upload.run();
    expect(renew).toHaveBeenCalledTimes(1);
    expect(cf.calls.map((c) => [c.method, c.url === ADDRESS2 ? 'new' : 'old', c.headers['Upload-Offset'] ?? '-'])).toEqual([
      ['PATCH', 'old', '0'], ['PATCH', 'old', String(8 * MiB)], ['PATCH', 'new', '0'], ['PATCH', 'new', String(8 * MiB)],
    ]);
    expect(cf.received.get(ADDRESS2)).toBe(10 * MiB);
    expect(seen).toContain(0); // the bar goes back to the start
  });

  it('pauses after six failures in a row (2, 4, 8, 16, 32 s between), and run() resumes after asking Cloudflare', async () => {
    const script = Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, 'network' as const]));
    const cf = fakeCloudflareTus({ script });
    const waits: number[] = [];
    const upload = new TusUpload({ blob: bigBlob(6 * MiB), url: ADDRESS, renew: vi.fn(), createXhr: cf.createXhr, wait: async (ms) => { waits.push(ms); } });
    const error = await upload.run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TusError);
    expect((error as TusError).kind).toBe('paused');
    expect(waits).toEqual([2000, 4000, 8000, 16_000, 32_000]);
    expect(cf.calls.map((c) => c.method)).toEqual(['PATCH', 'HEAD', 'HEAD', 'HEAD', 'HEAD', 'HEAD']);
    await upload.run(); // "Retry"
    expect(cf.calls.slice(6).map((c) => c.method)).toEqual(['HEAD', 'PATCH']);
    expect(cf.received.get(ADDRESS)).toBe(6 * MiB);
    expect(backoffMs(7)).toBe(60_000);
  });

  it('a refusal a retry cannot fix is an error at once; the address never appears in a message', async () => {
    const cf = fakeCloudflareTus({ script: { 1: { status: 400 } } });
    const error = await new TusUpload({ blob: bigBlob(1000), url: ADDRESS, renew: vi.fn(), createXhr: cf.createXhr, wait: async () => undefined }).run().catch((e: unknown) => e);
    expect((error as TusError).kind).toBe('fatal');
    expect((error as TusError).message).not.toContain('upload.videodelivery.net');
  });

  it('only Cloudflare\'s two upload hosts are accepted', () => {
    expect(checkUploadUrl(ADDRESS)).toBe(ADDRESS);
    expect(checkUploadUrl('https://upload.cloudflarestream.com/tus/abc')).toBe('https://upload.cloudflarestream.com/tus/abc');
    for (const bad of ['http://upload.videodelivery.net/tus/x', 'https://upload.videodelivery.net.evil.com/tus/x', 'https://evil.com/tus/x', 'https://upload.videodelivery.net:8443/tus/x',
      'https://user:pw@upload.videodelivery.net/tus/x', 'https://upload.videodelivery.net/tus/x#y', 'https://upload.videodelivery.net/tus/<x>', 'nope']) {
      expect(() => checkUploadUrl(bad), bad).toThrow(TusError);
    }
    expect(() => new TusUpload({ blob: bigBlob(1), url: 'https://evil.com/tus/x', renew: vi.fn() })).toThrow(TusError);
  });

  it('announces progress at most every quarter', () => {
    expect(crossedMilestone(0, 10)).toBeNull();
    expect(crossedMilestone(10, 26)).toBe(25);
    expect(crossedMilestone(24, 80)).toBe(75);
    expect(crossedMilestone(99, 100)).toBe(100);
    expect(crossedMilestone(100, 100)).toBeNull();
  });
});

// ============================================================================ the upload job

const recording = (over: Partial<Recording> = {}) => ({ id: 'd'.repeat(24), _id: 'd'.repeat(24), title: 'Vespers', status: 'uploading', published: false, durationSeconds: 60, sizeBytes: 10, thumbnailUrl: null, playbackUrl: null, ...over }) as Recording;

function fakeApi(over: Partial<RecordingApi> = {}) {
  const api = {
    create: vi.fn(async () => ({ recordingId: 'd'.repeat(24), uploadUrl: ADDRESS, recording: recording() })),
    renew: vi.fn(async () => ({ recordingId: 'd'.repeat(24), uploadUrl: ADDRESS2, recording: recording() })),
    uploaded: vi.fn(async () => ({ recording: recording({ status: 'processing' }) })),
    ...over,
  };
  return api;
}

describe('the recording upload job (lib/recording-upload.ts)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks for an address, sends the file to Cloudflare, says it finished and deletes the local copy', async () => {
    const { store } = await openFake();
    const meta = localRecording({ sizeBytes: 6 * MiB, title: 'Vespers & psalms' });
    await store.putMeta(meta);
    await store.putChunk(meta.localId, 0, blobOf('x'));
    const cf = fakeCloudflareTus();
    const api = fakeApi();
    const phases: string[] = [];
    const job = new RecordingUploadJob({ meta, blob: bigBlob(6 * MiB), api, store, onPhase: (p) => phases.push(p), tus: { createXhr: cf.createXhr, wait: async () => undefined } });
    const done = await job.run();
    expect(done.status).toBe('processing');
    expect(api.create).toHaveBeenCalledWith({ sessionId: meta.sessionId, sizeBytes: 6 * MiB, durationSeconds: 60, mimeType: 'video/webm', title: 'Vespers & psalms' });
    expect(api.uploaded).toHaveBeenCalledWith('d'.repeat(24));
    expect(cf.received.get(ADDRESS)).toBe(6 * MiB);
    expect(phases).toEqual(['address', 'sending', 'finishing', 'done']);
    expect(await store.get(meta.localId)).toBeNull();
    expect(await store.chunks(meta.localId)).toEqual([]);
  });

  it('after a crash: the broadcast already has a recording (409), so its address is renewed and the upload starts from 0', async () => {
    const existing = recording({ status: 'uploading' });
    const api = fakeApi({ create: vi.fn(async () => { throw new ApiError(409, 'This broadcast already has a recording', { body: { error: 'x', recording: existing } }); }) });
    const cf = fakeCloudflareTus();
    const job = new RecordingUploadJob({ meta: localRecording(), blob: bigBlob(100), api, store: null, tus: { createXhr: cf.createXhr } });
    await job.run();
    expect(api.renew).toHaveBeenCalledWith(existing.id, { sizeBytes: 100, durationSeconds: 60, mimeType: 'video/webm' });
    expect(cf.calls[0]).toMatchObject({ url: ADDRESS2, headers: { 'Upload-Offset': '0' } });
  });

  it('a copy that knows its recording renews it; one that is already processing needs nothing more', async () => {
    const { store } = await openFake();
    const meta = localRecording({ recordingId: 'e'.repeat(24) });
    await store.putMeta(meta);
    const already = recording({ status: 'processing' });
    const api = fakeApi({ renew: vi.fn(async () => { throw new ApiError(409, 'This recording has already been uploaded', { body: { recording: already } }); }) });
    const job = new RecordingUploadJob({ meta, blob: bigBlob(100), api, store });
    expect((await job.run()).status).toBe('processing');
    expect(api.create).not.toHaveBeenCalled();
    expect(api.uploaded).not.toHaveBeenCalled();
    expect(await store.get(meta.localId)).toBeNull();
    expect(new AlreadyUploaded(already).recording).toBe(already);
  });

  it('remembers the recording id (never the address) as soon as it has one', async () => {
    const { factory, store } = await openFake();
    const meta = localRecording();
    await store.putMeta(meta);
    const cf = fakeCloudflareTus({ script: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, 'network' as const])) });
    const job = new RecordingUploadJob({ meta, blob: bigBlob(100), api: fakeApi(), store, tus: { createXhr: cf.createXhr, wait: async () => undefined } });
    const error = await job.run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UploadStopped);
    expect((error as UploadStopped).problem).toBe('paused');
    expect((error as UploadStopped).retryable).toBe(true);
    expect(job.phase).toBe('paused');
    expect(await store.get(meta.localId)).toMatchObject({ recordingId: 'd'.repeat(24), state: 'uploading' });
    expect(JSON.stringify([...factory.dbs.get('nhc-live-recordings')!.stores.get('recordings')!.rows.values()])).not.toContain('upload.videodelivery.net');
    // Retry: the same address, from what Cloudflare has
    await job.run();
    expect(cf.calls.slice(6).map((c) => c.method)).toEqual(['HEAD', 'PATCH']);
  });

  it('a copy Cloudflare already has in full (the tab died before telling the API) is only reported as uploaded', async () => {
    const { store } = await openFake();
    const meta = localRecording({ recordingId: 'e'.repeat(24), state: 'sent' });
    await store.putMeta(meta);
    const api = fakeApi();
    expect((await new RecordingUploadJob({ meta, blob: bigBlob(100), api, store }).run()).status).toBe('processing');
    expect(api.uploaded).toHaveBeenCalledWith('e'.repeat(24));
    expect(api.renew).not.toHaveBeenCalled();
    expect(await store.get(meta.localId)).toBeNull();

    // ...unless Cloudflare could not use it (409): then it is sent again with a renewed address
    const cf = fakeCloudflareTus();
    let first = true;
    const failedOnce = fakeApi({ uploaded: vi.fn(async () => { if (first) { first = false; throw new ApiError(409, 'This recording failed. Upload it again.'); } return { recording: recording({ status: 'processing' }) }; }) });
    await new RecordingUploadJob({ meta, blob: bigBlob(100), api: failedOnce, store: null, tus: { createXhr: cf.createXhr } }).run();
    expect(failedOnce.renew).toHaveBeenCalledWith('e'.repeat(24), expect.objectContaining({ sizeBytes: 100 }));
    expect(cf.received.get(ADDRESS2)).toBe(100);
    expect(failedOnce.uploaded).toHaveBeenCalledTimes(2);
  });

  it('marks the copy "sent" once Cloudflare has every byte, before telling the API', async () => {
    const { store } = await openFake();
    const meta = localRecording();
    await store.putMeta(meta);
    const states: (string | undefined)[] = [];
    const api = fakeApi({ uploaded: vi.fn(async () => { states.push((await store.get(meta.localId))?.state); return { recording: recording({ status: 'processing' }) }; }) });
    await new RecordingUploadJob({ meta, blob: bigBlob(100), api, store, tus: { createXhr: fakeCloudflareTus().createXhr } }).run();
    expect(states).toEqual(['sent']);
  });

  it('says why it stopped: not yours (403), gone (404), not set up (503) cannot be retried; Cloudflare (502) can', async () => {
    for (const [status, problem, retryable] of [[403, 'notYours', false], [404, 'gone', false], [503, 'notConfigured', false], [502, 'paused', true]] as const) {
      const api = fakeApi({ create: vi.fn(async () => { throw new ApiError(status, 'x'); }) });
      const error = (await new RecordingUploadJob({ meta: localRecording(), blob: bigBlob(10), api, store: null }).run().catch((e: unknown) => e)) as UploadStopped;
      expect([error.problem, error.retryable], String(status)).toEqual([problem, retryable]);
    }
    const empty = (await new RecordingUploadJob({ meta: localRecording(), blob: new Blob([]), api: fakeApi(), store: null }).run().catch((e: unknown) => e)) as UploadStopped;
    expect(empty.problem).toBe('empty');
  });
});

// ============================================================================ scheduled broadcasts

describe('Nazareth time (lib/schedule.ts), the same rules as the API', () => {
  it('converts Nazareth wall time to UTC, winter (+2) and summer (+3)', () => {
    expect(nazarethToUtc('2027-01-10T19:30')?.toISOString()).toBe('2027-01-10T17:30:00.000Z');
    expect(nazarethToUtc('2026-07-01T08:00')?.toISOString()).toBe('2026-07-01T05:00:00.000Z');
    expect(utcToNazarethLocal('2027-01-10T17:30:00.000Z')).toBe('2027-01-10T19:30');
    expect(utcToNazarethLocal('2026-07-01T05:00:00.000Z')).toBe('2026-07-01T08:00');
  });

  it('the two days the clock changes: a skipped time moves forward, a repeated one is the first (summer time)', () => {
    // 2027-03-26 02:00 -> 03:00 (spring); 2026-10-25 02:00 -> 01:00 (autumn)
    expect(nazarethToUtc('2027-03-26T02:30')?.toISOString()).toBe('2027-03-26T00:30:00.000Z');
    expect(utcToNazarethLocal('2027-03-26T00:30:00.000Z')).toBe('2027-03-26T03:30');
    expect(nazarethToUtc('2026-10-25T01:30')?.toISOString()).toBe('2026-10-24T22:30:00.000Z');
  });

  it('refuses what is not a real date and time', () => {
    for (const bad of ['2027-02-30T10:00', '2027-13-01T10:00', '2027-01-01T24:00', '2027-01-01 10:00', '', 'tomorrow']) expect(nazarethToUtc(bad), bad).toBeNull();
    expect(normalizeLocal('2027-01-01T10:00:00')).toBe('2027-01-01T10:00');
    expect(normalizeLocal('2027-01-01T10:00:00.000')).toBe('2027-01-01T10:00');
    expect(normalizeLocal('soon')).toBe('');
  });

  it('checks the time like the API: five minutes in the past at most, about a year ahead at most', () => {
    const now = Date.parse('2026-10-07T10:00:00.000Z'); // 13:00 in Nazareth
    expect(scheduleTimeProblem('2026-10-07T12:56', now)).toBeNull();
    expect(scheduleTimeProblem('2026-10-07T12:54', now)).toBe('past');
    expect(scheduleTimeProblem('2027-11-20T10:00', now)).toBe('tooFar');
    expect(scheduleTimeProblem('2027-10-07T10:00', now)).toBeNull();
    expect(scheduleTimeProblem('2026-02-30T10:00', now)).toBe('format');
  });

  it('"Go live" suggests the waiting broadcast closest to now, within two hours either way', () => {
    const now = Date.parse('2026-10-07T17:00:00.000Z');
    const at = (minutes: number, status: 'scheduled' | 'live' | 'done' | 'cancelled' = 'scheduled', id = String(minutes)) => ({ id, status, startsAt: new Date(now + minutes * 60_000).toISOString() });
    expect(matchScheduled([at(-90), at(30), at(200)], now)?.id).toBe('30');
    expect(matchScheduled([at(-20), at(30)], now)?.id).toBe('-20');
    expect(matchScheduled([at(121), at(-121)], now)).toBeNull();
    expect(matchScheduled([at(120)], now)?.id).toBe('120');
    expect(matchScheduled([at(5, 'cancelled'), at(10, 'done'), at(1, 'live')], now)).toBeNull();
    expect(matchScheduled([], now)).toBeNull();
  });

  it('a broadcast still "scheduled" two hours after its start shows as missed', () => {
    const now = Date.parse('2026-10-07T17:00:00.000Z');
    const item = (hoursAgo: number, status: 'scheduled' | 'done' = 'scheduled') => ({ status, startsAt: new Date(now - hoursAgo * 3600_000).toISOString() });
    expect(isMissed(item(3), now)).toBe(true);
    expect(isMissed(item(1), now)).toBe(false);
    expect(displayStatus(item(3), now)).toBe('missed');
    expect(displayStatus(item(3, 'done'), now)).toBe('done');
  });

  it('knows when the admin\'s own clock shows another time than Nazareth', () => {
    expect(differsFromNazareth('2026-10-07T17:00:00.000Z', 'Asia/Jerusalem')).toBe(false);
    expect(differsFromNazareth('2026-10-07T17:00:00.000Z', 'Asia/Hebron')).toBe(false);
    expect(differsFromNazareth('2026-10-07T17:00:00.000Z', 'Europe/London')).toBe(true);
    expect(differsFromNazareth('nope', 'Europe/London')).toBe(false);
  });
});

// ============================================================================ API answers, security rules, messages

describe('answers, CSP, proxy and messages for recordings and the schedule', () => {
  const rec = {
    _id: 'f'.repeat(24), session: 'a'.repeat(24), title: 'Vespers &amp; psalms', liveStartedAt: '2026-10-06T17:00:00.000Z', liveEndedAt: null, durationSeconds: 75, sizeBytes: 9,
    mimeType: 'video/webm', cfVideoUid: '0'.repeat(32), status: 'ready', failReason: null, published: false, publishedAt: null,
    thumbnailUrl: `https://customer-abc.cloudflarestream.com/${'0'.repeat(32)}/thumbnails/thumbnail.jpg`, playbackUrl: `https://customer-abc.cloudflarestream.com/${'0'.repeat(32)}/iframe`,
    createdBy: { id: 'u', name: 'editor' }, createdAt: '2026-10-06T18:00:00.000Z',
  };

  it('a recording is parsed strictly: only Cloudflare\'s own player and picture addresses are kept', () => {
    const parsed = recordingSchema.parse(rec);
    expect(parsed.id).toBe('f'.repeat(24));
    expect(parsed.playbackUrl).toBe(rec.playbackUrl);
    const evil = recordingSchema.parse({ ...rec, playbackUrl: 'https://evil.example/iframe', thumbnailUrl: 'javascript:alert(1)' });
    expect([evil.playbackUrl, evil.thumbnailUrl]).toEqual([null, null]);
    expect(recordingSchema.safeParse({ ...rec, status: 'paused' }).success).toBe(false);
    expect(recordingsStateSchema.safeParse({ configured: true, items: [rec], storage: { usedMinutes: 1, limitMinutes: 1000, videos: 1, source: 'cloudflare', pricePer1000Minutes: 5 } }).success).toBe(true);
    expect(recordingsStateSchema.safeParse({ configured: true, items: [], storage: { usedMinutes: 1, limitMinutes: 1000, videos: null, source: 'guess', pricePer1000Minutes: 5 } }).success).toBe(false);
  });

  it('an upload answer must carry a Cloudflare tus address', () => {
    expect(recordingUploadSchema.safeParse({ recordingId: rec._id, uploadUrl: ADDRESS, recording: rec }).success).toBe(true);
    expect(recordingUploadSchema.safeParse({ recordingId: rec._id, uploadUrl: 'https://evil.example/tus/x', recording: rec }).success).toBe(false);
    expect(recordingUploadSchema.safeParse({ recordingId: rec._id, uploadUrl: 'https://upload.videodelivery.net.evil.example/tus/x', recording: rec }).success).toBe(false);
  });

  it('a scheduled broadcast needs its Nazareth time and a known status', () => {
    const item = { _id: 'a'.repeat(24), title: 'T', description: '', startsAt: '2026-10-20T16:30:00.000Z', startsAtLocal: '2026-10-20T19:30', timeZone: 'Asia/Jerusalem', published: true, status: 'scheduled', liveSession: null };
    expect(scheduledSchema.parse(item).id).toBe('a'.repeat(24));
    expect(scheduledSchema.safeParse({ ...item, status: 'postponed' }).success).toBe(false);
    expect(scheduledSchema.safeParse({ ...item, startsAtLocal: '2026-10-20 19:30' }).success).toBe(false);
    expect(scheduledSchema.parse({ ...item, description: null }).description).toBe('');
  });

  it('/live (only) may upload to Cloudflare, frame its player and show its pictures', () => {
    const live = buildCsp({ nonce: 'n', live: true });
    expect(live).toMatch(/connect-src [^;]*https:\/\/\*\.cloudflarestream\.com https:\/\/upload\.videodelivery\.net https:\/\/upload\.cloudflarestream\.com(;|$)/);
    expect(live).toContain('frame-src https://*.cloudflarestream.com;');
    expect(live).toMatch(/img-src [^;]*https:\/\/\*\.cloudflarestream\.com/);
    const other = buildCsp({ nonce: 'n' });
    expect(other).not.toMatch(/cloudflarestream|videodelivery|frame-src/);
    const cookie = `nhc_admin=${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.s`;
    const page = (path: string) => proxy(new NextRequest(`http://localhost:3901${path}`, { headers: { host: 'localhost:3901', cookie } })).headers.get('content-security-policy') ?? '';
    expect(page('/live')).toContain('upload.videodelivery.net');
    expect(page('/live')).toContain('frame-src https://*.cloudflarestream.com');
    for (const path of ['/', '/orders', '/products', '/live/x']) expect(page(path)).not.toMatch(/videodelivery|frame-src|cloudflarestream/);
    expect(page('/live')).toContain("frame-ancestors 'none'"); // nobody may frame the dashboard itself
  });

  it('the proxy forwards exactly the recordings and schedule routes', () => {
    const id = 'a'.repeat(24);
    const ok: [string[], string][] = [
      [['live', 'recordings'], 'GET'], [['live', 'recordings'], 'POST'], [['live', 'recordings', id, 'upload-url'], 'POST'], [['live', 'recordings', id, 'uploaded'], 'POST'],
      [['live', 'recordings', id], 'PATCH'], [['live', 'recordings', id], 'DELETE'],
      [['live', 'schedule'], 'GET'], [['live', 'schedule'], 'POST'], [['live', 'schedule', id], 'PATCH'], [['live', 'schedule', id], 'DELETE'],
    ];
    for (const [segments, method] of ok) expect(resolveProxyPath(segments, method), `${method} ${segments.join('/')}`).toBe(`/admin/${segments.join('/')}`);
    const refused: [string[], string][] = [
      [['live', 'recordings', id], 'GET'], [['live', 'recordings'], 'DELETE'], [['live', 'recordings', id, 'uploaded'], 'GET'], [['live', 'recordings', id, 'other'], 'POST'],
      [['live', 'recordings', 'not-an-id'], 'PATCH'], [['live', 'recordings', id, 'upload-url', 'x'], 'POST'], [['live', 'schedule', id], 'GET'], [['live', 'schedule', id, 'x'], 'PATCH'],
      [['live', 'schedule'], 'PUT'], [['orders', id, 'x', 'y'], 'GET'], [['live', 'recordings', '..', 'uploaded'], 'POST'], [['live', 'recordings', id.toUpperCase()], 'PATCH'],
    ];
    for (const [segments, method] of refused) expect(resolveProxyPath(segments, method), `${method} ${segments.join('/')}`).toBeNull();
  });

  it('every new message exists in English, Hebrew and Arabic', () => {
    const keys = Object.keys(en).filter((k) => /^live\.(rec|upload|unfinished|sched|record|fulfils|storage)/.test(k));
    expect(keys.length).toBeGreaterThan(60);
    expect(keys.filter((k) => !(k in he))).toEqual([]);
    expect(keys.filter((k) => !(k in ar))).toEqual([]);
  });
});
