import { expect, type Page } from '@playwright/test';
import { API, APP, freshIp, HARNESS, USERS } from './helpers';

// Shared by live.spec.ts and live-recordings.spec.ts: the backend's test controls, the API as an owner or editor, and a
// FAKE Cloudflare answered inside the browser (Playwright routes), so nothing ever reaches Cloudflare:
//   customer-<code>.cloudflarestream.com   WHIP (the SDP answer of a second RTCPeerConnection in the same page),
//                                         the Stream player page (a tiny local page) and thumbnails (a 1x1 picture)
//   upload.videodelivery.net / upload.cloudflarestream.com   the tus upload of a recording (PATCH, HEAD)
// No STUN server is asked either (the init script removes the ICE servers).

const CONTROL = HARNESS ? '/__harness/live' : '/__mock/live';

export type LiveControl = { configured?: boolean; failCreate?: boolean; failUpload?: boolean; videoState?: 'queued' | 'inprogress' | 'ready' | 'error'; videoUid?: string; durationSeconds?: number };

export async function control(options: LiveControl) {
  const res = await fetch(`${API}${CONTROL}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) });
  expect(res.ok).toBeTruthy();
  return (await res.json()) as { videos: { uid: string; state: string; sizeBytes: number }[] };
}

/** The public status the website polls (straight from the API under test). */
export async function publicStatus(): Promise<{ live: boolean; title?: string; playbackUrl?: string }> {
  return (await fetch(`${API}/live/status`)).json();
}

/**
 * `editor` and `owner` here are the live specs' own accounts (`liveeditor`, `liveowner`: the ones their pages are signed
 * in as), so the rest of the suite keeps its own share of the API's per-admin request limit.
 */
export async function apiAs(role: 'owner' | 'editor') {
  const user = role === 'editor' ? USERS.liveeditor : USERS.liveowner;
  const login = await fetch(`${API}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': freshIp() },
    body: JSON.stringify({ username: user.username, password: user.password }),
  });
  const { token } = (await login.json()) as { token: string };
  return (method: string, path: string, body?: unknown) =>
    fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Forwarded-For': freshIp() }, body: body === undefined ? undefined : JSON.stringify(body) });
}

/** Ends whatever is live (as an owner, confirmed), so every test starts with nothing on air. */
export async function endEverything() {
  const owner = await apiAs('owner');
  await owner('POST', '/admin/live/stop', { force: true });
}

/**
 * Deletes every recording and scheduled broadcast (as an owner), so later tests and other spec files never show a
 * thumbnail (an <img> on a Cloudflare host) that no route of theirs would answer.
 */
export async function cleanRecordingsAndSchedule() {
  await endEverything();
  const owner = await apiAs('owner');
  const recordings = (await (await owner('GET', '/admin/live/recordings')).json()) as { items?: { _id: string }[] };
  for (const r of recordings.items ?? []) await owner('DELETE', `/admin/live/recordings/${r._id}`);
  const schedule = (await (await owner('GET', '/admin/live/schedule')).json()) as { items?: { _id: string }[] };
  for (const s of schedule.items ?? []) await owner('DELETE', `/admin/live/schedule/${s._id}`);
}

/** A broadcast started and ended by `role`, and its recording uploaded (straight through the API) and made ready. */
export async function seedRecording(title: string, { publish = false, role = 'editor' as 'editor' | 'owner' } = {}) {
  const as = await apiAs(role);
  const started = (await (await as('POST', '/admin/live/start', { title })).json()) as { session: { _id: string } };
  await as('POST', '/admin/live/stop', { sessionId: started.session._id });
  const created = (await (await as('POST', '/admin/live/recordings', { sessionId: started.session._id, sizeBytes: 4096, durationSeconds: 95, mimeType: 'video/webm;codecs=vp9,opus' })).json()) as { recordingId: string; recording: { cfVideoUid: string } };
  // Cloudflare is done before "uploaded" is said, so the API's check right then finds it ready (a later list asks
  // Cloudflare again only after 10 seconds, so the order matters).
  await control({ videoState: 'ready', videoUid: created.recording.cfVideoUid, durationSeconds: 95 });
  await as('POST', `/admin/live/recordings/${created.recordingId}/uploaded`);
  if (publish) expect((await as('PATCH', `/admin/live/recordings/${created.recordingId}`, { published: true })).status).toBe(200);
  return created.recordingId;
}

export type FakeCloudflare = {
  posts: number;
  deletes: number;
  offers: string[];
  /** tus requests: method, offset sent, body size, headers. */
  tus: { method: string; offset: number | null; size: number; headers: Record<string, string> }[];
  /** Bytes received per upload address. */
  received: Map<string, number>;
  /** Hold the next PATCH until release() (to look at the progress), or make the next one fail like a lost network. */
  hold(): void;
  release(): void;
  failNextPatch(): void;
  thumbnails: number;
  players: number;
};

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const PLAYER = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Video player</title></head><body><main><p>Fake Cloudflare player</p></main></body></html>';

/** Answers the page's Cloudflare traffic like Cloudflare would (see the top of this file). WHIP refuses with `status`. */
export async function fakeCloudflare(page: Page, { status = 201 }: { status?: number } = {}): Promise<FakeCloudflare> {
  let holding: Promise<void> | null = null;
  let free: () => void = () => undefined;
  let failNext = false;
  const calls: FakeCloudflare = {
    posts: 0, deletes: 0, offers: [], tus: [], received: new Map(), thumbnails: 0, players: 0,
    hold() { holding = new Promise<void>((resolve) => { free = resolve; }); },
    release() { free(); holding = null; },
    failNextPatch() { failNext = true; },
  };
  await page.addInitScript(() => {
    // No STUN: the connection stays on this machine.
    const Real = window.RTCPeerConnection;
    class LocalOnly extends Real {
      constructor(config?: RTCConfiguration) {
        super({ ...config, iceServers: [] });
      }
    }
    window.RTCPeerConnection = LocalOnly;
    // The "Cloudflare" side: a receiving peer in the same page.
    (window as unknown as { __fakeWhipAnswer: (offer: string) => Promise<string> }).__fakeWhipAnswer = async (offer: string) => {
      const pc = new RTCPeerConnection();
      const w = window as unknown as { __whipTracks: number; __whipPeers: RTCPeerConnection[] };
      w.__whipPeers = [...(w.__whipPeers ?? []), pc];
      pc.ontrack = () => { w.__whipTracks = (w.__whipTracks ?? 0) + 1; };
      await pc.setRemoteDescription({ type: 'offer', sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const timer = setTimeout(resolve, 2000);
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); }
        });
      });
      return pc.localDescription!.sdp;
    };
  });
  await page.route(/^https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\//, async (route) => {
    const request = route.request();
    const cors = { 'Access-Control-Allow-Origin': APP, 'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, accept', 'Access-Control-Expose-Headers': 'Location' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (request.method() === 'DELETE') {
      calls.deletes += 1;
      return route.fulfill({ status: 200, headers: cors });
    }
    if (request.method() === 'GET') {
      if (/\/thumbnails\/thumbnail\.jpg$/.test(request.url())) {
        calls.thumbnails += 1;
        return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
      }
      calls.players += 1;
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PLAYER });
    }
    calls.posts += 1;
    expect(request.headers()['content-type']).toBe('application/sdp');
    expect(request.headers().cookie).toBeUndefined(); // credentials: 'omit'
    const offer = request.postData() ?? '';
    calls.offers.push(offer);
    if (status !== 201) return route.fulfill({ status, headers: cors, body: 'refused' });
    const answer = await page.evaluate((sdp) => (window as unknown as { __fakeWhipAnswer: (o: string) => Promise<string> }).__fakeWhipAnswer(sdp), offer);
    return route.fulfill({ status: 201, headers: { ...cors, 'Content-Type': 'application/sdp', Location: '/whip-session/1' }, body: answer });
  });
  // The tus endpoint, with the CORS headers a real tus server sends (the page reads Upload-Offset).
  await page.route(/^https:\/\/upload\.(videodelivery\.net|cloudflarestream\.com)\//, async (route) => {
    const request = route.request();
    const url = request.url();
    const cors = {
      'Access-Control-Allow-Origin': APP,
      'Access-Control-Allow-Methods': 'PATCH, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Tus-Resumable, Upload-Offset, Content-Type',
      'Access-Control-Expose-Headers': 'Upload-Offset, Location, Tus-Resumable',
      'Tus-Resumable': '1.0.0',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'Access-Control-Max-Age': '600' } });
    const headers = request.headers();
    expect(headers.cookie).toBeUndefined(); // no cookie of ours ever goes to Cloudflare
    const have = calls.received.get(url) ?? 0;
    if (request.method() === 'HEAD') {
      calls.tus.push({ method: 'HEAD', offset: null, size: 0, headers });
      return route.fulfill({ status: 200, headers: { ...cors, 'Upload-Offset': String(have), 'Cache-Control': 'no-store' } });
    }
    const body = request.postDataBuffer() ?? Buffer.alloc(0);
    const offset = Number(headers['upload-offset']);
    calls.tus.push({ method: request.method(), offset, size: body.length, headers });
    if (failNext) {
      failNext = false;
      return route.abort('failed');
    }
    if (holding) await holding;
    if (offset !== have) return route.fulfill({ status: 409, headers: cors });
    calls.received.set(url, have + body.length);
    return route.fulfill({ status: 204, headers: { ...cors, 'Upload-Offset': String(have + body.length) } });
  });
  page.on('dialog', (dialog) => void dialog.accept()); // "leave the page?" while live or uploading
  return calls;
}

/**
 * Replaces MediaRecorder with a fake that gives a small piece (2 KB) every 250 ms, so a recording is quick, small and
 * the same in every browser. window.__chunks counts the pieces.
 */
export async function stubMediaRecorder(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __chunks: number; MediaRecorder: unknown };
    w.__chunks = 0;
    class FakeMediaRecorder extends EventTarget {
      static isTypeSupported(type: string) {
        return /^video\/webm/.test(type);
      }
      state: 'inactive' | 'recording' = 'inactive';
      mimeType: string;
      private timer = 0;
      constructor(_stream: MediaStream, options: MediaRecorderOptions = {}) {
        super();
        this.mimeType = options.mimeType ?? 'video/webm';
      }
      start() {
        this.state = 'recording';
        this.timer = window.setInterval(() => this.emit(), 250);
      }
      private emit() {
        w.__chunks += 1;
        const event = new Event('dataavailable');
        Object.defineProperty(event, 'data', { value: new Blob([new Uint8Array(2048).fill(w.__chunks % 256)], { type: this.mimeType }) });
        this.dispatchEvent(event);
      }
      requestData() {
        this.emit();
      }
      stop() {
        if (this.state === 'inactive') return;
        window.clearInterval(this.timer);
        this.emit();
        this.state = 'inactive';
        window.setTimeout(() => this.dispatchEvent(new Event('stop')), 10);
      }
      pause() {}
      resume() {}
    }
    w.MediaRecorder = FakeMediaRecorder;
  });
}

/** What this browser keeps in IndexedDB: recordings (with their piece counts). */
export async function localRecordings(page: Page): Promise<{ title: string; state: string; sizeBytes: number; pieces: number; recordingId: string | null; text: string }[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nhc-live-recordings', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('recordings', { keyPath: 'localId' });
        request.result.createObjectStore('chunks', { keyPath: ['localId', 'index'] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = <T,>(store: string) => new Promise<T[]>((resolve, reject) => {
      const request = db.transaction([store], 'readonly').objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
    const metas = await all<{ localId: string; title: string; state: string; sizeBytes: number; recordingId: string | null }>('recordings');
    const chunks = await all<{ localId: string }>('chunks');
    db.close();
    return metas.map((m) => ({ title: m.title, state: m.state, sizeBytes: m.sizeBytes, recordingId: m.recordingId, pieces: chunks.filter((c) => c.localId === m.localId).length, text: JSON.stringify(m) }));
  });
}
