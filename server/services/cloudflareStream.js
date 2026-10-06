import { config } from '../config/env.js';

// Cloudflare Stream, WebRTC mode (docs/LIVE.md): https://developers.cloudflare.com/stream/webrtc-beta/
//
//   createLiveInput()  POST   /accounts/{account}/stream/live_inputs        -> { uid, whipUrl, whepUrl }
//   deleteLiveInput()  DELETE /accounts/{account}/stream/live_inputs/{uid}
//
// The browser of the admin publishes to `whipUrl` (WHIP); viewers play `whepUrl` (WHEP) or the Stream player page
// derived from it (playerUrl). WebRTC inputs have no recording, no HLS and no viewer counts.
//
// Recordings (docs/LIVE.md "Recordings"): the admin's browser records the broadcast itself and uploads the file
// straight to Cloudflare with a one-time address (Direct Creator Upload, tus protocol):
//
//   createUpload()   POST   /accounts/{account}/stream?direct_user=true   (Tus-Resumable, Upload-Length, Upload-Metadata)
//                    -> Location: the one-time tus address, stream-media-id: the video id
//   getVideo()       GET    /accounts/{account}/stream/{uid}               -> state, readyToStream, duration, thumbnail
//   deleteVideo()    DELETE /accounts/{account}/stream/{uid}
//   storageUsage()   GET    /accounts/{account}/stream/storage-usage       -> minutes stored and the plan's limit
//
// https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/ and .../resumable-uploads/
//
// Secrets: the API token goes only into the Authorization header of a request to api.cloudflare.com. The WHIP address
// contains the input's broadcast secret, and the one-time upload address lets anyone upload one video into the account:
// both are returned to the caller and never logged here (errors carry Cloudflare's status and error codes only, never a
// URL that Cloudflare returned and never a header).
//
// The client is injectable: tests and the local harness install a fake with setStreamClient() (test-harness/
// fake-cloudflare.js), so nothing in a test ever reaches the network.

export const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 15_000;

/** A Stream host of a Cloudflare customer: customer-<code>.cloudflarestream.com. */
export const STREAM_HOST = /^customer-[a-z0-9]{1,64}\.cloudflarestream\.com$/;
const INPUT_UID = /^[a-f0-9]{32}$/;
const VIDEO_UID = INPUT_UID;
const PATH_SEGMENT = /^[A-Za-z0-9_-]{1,256}$/;
const CUSTOMER_CODE = /^[a-z0-9]{1,64}$/;

/**
 * The hosts Cloudflare gives one-time tus upload addresses on (Direct Creator Upload). Exact names: an address on any
 * other host is refused (the dashboard's Content-Security-Policy allows the same two, admin/src/lib/csp.ts).
 */
export const UPLOAD_HOSTS = ['upload.videodelivery.net', 'upload.cloudflarestream.com'];
/** Cloudflare's ceiling for `maxDurationSeconds` of an upload: six hours (also our longest broadcast). */
export const MAX_VIDEO_SECONDS = 21_600;
/** The largest file we ask Cloudflare to accept: six hours at about 2.5 Mbit/s is under 7 GB; tus allows 30 GB. */
export const MAX_UPLOAD_BYTES = 30 * 1024 ** 3;

/** The customer code of a Stream address (https://customer-<code>.cloudflarestream.com/...), or null. */
export function customerCodeOf(value) {
  try {
    const { hostname, protocol } = new URL(String(value ?? ''));
    if (protocol !== 'https:' || !STREAM_HOST.test(hostname)) return null;
    return hostname.slice('customer-'.length, -'.cloudflarestream.com'.length);
  } catch {
    return null;
  }
}

/** Cloudflare's player page of a stored video: https://customer-<code>.cloudflarestream.com/<uid>/iframe (or null). */
export function videoPlayerUrl(customerCode, uid) {
  if (!CUSTOMER_CODE.test(String(customerCode ?? '')) || !VIDEO_UID.test(String(uid ?? ''))) return null;
  return `https://customer-${customerCode}.cloudflarestream.com/${uid}/iframe`;
}

/** The video's poster picture: https://customer-<code>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg (or null). */
export function videoThumbnailUrl(customerCode, uid) {
  if (!CUSTOMER_CODE.test(String(customerCode ?? '')) || !VIDEO_UID.test(String(uid ?? ''))) return null;
  return `https://customer-${customerCode}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;
}

/**
 * A one-time upload address Cloudflare gave us, checked: https, one of UPLOAD_HOSTS, no port or credentials, plain
 * path segments and query. Returns it as text, or throws (the message names the host at most, never the address).
 */
export function checkUploadUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? ''));
  } catch {
    throw new StreamError('Cloudflare sent no usable upload address');
  }
  if (url.protocol !== 'https:' || !UPLOAD_HOSTS.includes(url.hostname)) {
    const host = /^[a-z0-9.-]{1,100}$/i.test(url.hostname) ? url.hostname : 'an unknown host';
    throw new StreamError(`Cloudflare sent an upload address on an unexpected host (${host})`);
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const ok = !url.port && !url.username && !url.password && !url.hash && segments.length >= 1 && segments.length <= 4
    && segments.every((s) => PATH_SEGMENT.test(s)) && /^(\?[A-Za-z0-9_=&-]{0,200})?$/.test(url.search);
  if (!ok) throw new StreamError('Cloudflare sent an unexpected upload address');
  return url.toString();
}

/** tus Upload-Metadata: "key base64(value),key base64(value)". */
export const uploadMetadata = (entries) =>
  Object.entries(entries)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key} ${Buffer.from(String(value), 'utf8').toString('base64')}`)
    .join(',');

/** Cloudflare's processing states, in our words (model/liveRecording.js). */
export function recordingStateOf(video) {
  const state = String(video?.state ?? '');
  if (state === 'error') return 'failed';
  if (state === 'ready' && video?.readyToStream) return 'ready';
  if (['downloading', 'queued', 'inprogress', 'ready'].includes(state)) return 'processing';
  return 'uploading'; // pendingupload (or anything new): the file has not arrived yet
}

export class StreamError extends Error {
  constructor(message, { status = null } = {}) {
    super(message);
    this.name = 'StreamError';
    this.status = status; // Cloudflare's HTTP status, when it answered
  }
}

/**
 * A WebRTC address Cloudflare gave us, checked: https, a customer Stream host, plain path segments, ending in
 * /webRTC/publish (WHIP) or /webRTC/play (WHEP). Returns the address as text, or throws (the message never contains it).
 */
export function checkStreamUrl(value, kind) {
  const suffix = kind === 'publish' ? 'publish' : 'play';
  let url;
  try {
    url = new URL(String(value ?? ''));
  } catch {
    throw new StreamError(`Cloudflare sent no usable WebRTC ${suffix} address`);
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const ok = url.protocol === 'https:' && STREAM_HOST.test(url.hostname) && !url.port && !url.username && !url.password
    && !url.search && !url.hash && segments.length >= 3 && segments.at(-2) === 'webRTC' && segments.at(-1) === suffix
    && segments.every((s) => PATH_SEGMENT.test(s));
  if (!ok) throw new StreamError(`Cloudflare sent an unexpected WebRTC ${suffix} address`);
  return url.toString();
}

/**
 * The Stream player page for a live input: https://customer-<code>.cloudflarestream.com/<inputUid>/iframe. The player
 * switches to WHEP by itself when the input is a WebRTC one. Null when the WHEP address or the uid is not as expected.
 */
export function playerUrl(whepUrl, inputUid) {
  try {
    const { hostname, protocol } = new URL(String(whepUrl ?? ''));
    if (protocol !== 'https:' || !STREAM_HOST.test(hostname) || !INPUT_UID.test(String(inputUid ?? ''))) return null;
    return `https://${hostname}/${inputUid}/iframe`;
  } catch {
    return null;
  }
}

// Cloudflare's error list, as codes and short messages only (they never echo the token or our request).
const describeErrors = (json) =>
  (Array.isArray(json?.errors) ? json.errors : [])
    .slice(0, 3)
    .map((e) => [e?.code, typeof e?.message === 'string' ? e.message.replace(/[\r\n]+/g, ' ').slice(0, 120) : ''].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('; ');

export function createCloudflareStreamClient({ accountId, apiToken, fetchImpl = globalThis.fetch, baseUrl = CLOUDFLARE_API, timeoutMs = TIMEOUT_MS }) {
  if (!accountId || !apiToken) throw new Error('Cloudflare Stream needs an account id and an API token');
  const accountPath = `${baseUrl}/accounts/${encodeURIComponent(accountId)}/stream`;

  async function send(method, path, { body, headers = {} } = {}) {
    try {
      return await fetchImpl(`${accountPath}${path}`, {
        method,
        headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new StreamError(`Cloudflare Stream is unreachable (${err?.name === 'TimeoutError' ? 'timeout' : 'network error'})`);
    }
  }

  // The path names an input or video id at most (public: part of every viewer's playback address).
  const failure = (method, path, res, json) => {
    const detail = describeErrors(json);
    return new StreamError(`Cloudflare Stream ${method} ${path} failed (${res.status})${detail ? `: ${detail}` : ''}`, { status: res.status });
  };

  async function call(method, path, body) {
    const res = await send(method, path, { body });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success === false) throw failure(method, path, res, json);
    return json;
  }

  const checkVideoUid = (uid) => {
    if (!VIDEO_UID.test(String(uid ?? ''))) throw new StreamError('Invalid video id');
    return String(uid);
  };

  return {
    /** A new WebRTC live input. Recording is off (WebRTC inputs cannot record). */
    async createLiveInput({ name = 'Nazareth Holy Cross live' } = {}) {
      const json = await call('POST', '/live_inputs', {
        meta: { name: String(name).slice(0, 100) },
        recording: { mode: 'off' },
        enabled: true,
      });
      const result = json?.result;
      const uid = String(result?.uid ?? '');
      if (!INPUT_UID.test(uid)) throw new StreamError('Cloudflare sent no usable live input id');
      return {
        uid,
        whipUrl: checkStreamUrl(result?.webRTC?.url, 'publish'),
        whepUrl: checkStreamUrl(result?.webRTCPlayback?.url, 'play'),
      };
    },

    /** Deletes a live input. An input that no longer exists counts as deleted. */
    async deleteLiveInput(uid) {
      if (!INPUT_UID.test(String(uid ?? ''))) throw new StreamError('Invalid live input id');
      try {
        await call('DELETE', `/live_inputs/${uid}`);
      } catch (err) {
        if (err instanceof StreamError && err.status === 404) return { deleted: true, missing: true };
        throw err;
      }
      return { deleted: true };
    },

    /**
     * A one-time, resumable (tus) upload address for one video of `sizeBytes` bytes, for the admin's browser
     * (Direct Creator Upload). Cloudflare refuses the video if it is longer than `maxDurationSeconds`, and the address
     * after `expiresAt`. Returns { uid, uploadUrl }; the address is a secret of sorts (one upload into the account).
     */
    async createUpload({ sizeBytes, name = 'Nazareth Holy Cross recording', maxDurationSeconds = MAX_VIDEO_SECONDS, expiresAt } = {}) {
      if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_UPLOAD_BYTES) throw new StreamError('Invalid upload size');
      const seconds = Math.min(Math.max(Math.ceil(Number(maxDurationSeconds) || 0), 1), MAX_VIDEO_SECONDS);
      const res = await send('POST', '?direct_user=true', {
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Length': String(sizeBytes),
          'Upload-Metadata': uploadMetadata({
            name: String(name).replace(/[\r\n]+/g, ' ').slice(0, 100),
            maxDurationSeconds: seconds,
            expiry: expiresAt ? new Date(expiresAt).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined,
          }),
        },
      });
      if (!res.ok) throw failure('POST', '?direct_user=true', res, await res.json().catch(() => null));
      const uploadUrl = checkUploadUrl(res.headers.get('location'));
      // The id is in its own header (Cloudflare advises against reading it from the address); the address is the fallback.
      const uid = String(res.headers.get('stream-media-id') ?? '').trim() || new URL(uploadUrl).pathname.split('/').filter(Boolean).at(-1);
      if (!VIDEO_UID.test(uid)) throw new StreamError('Cloudflare sent no usable video id');
      return { uid, uploadUrl };
    },

    /**
     * What Cloudflare knows of a video: { uid, state, readyToStream, durationSeconds (null while unknown),
     * customerCode (from the thumbnail address), errorReason }. A video that does not exist throws a StreamError 404.
     */
    async getVideo(uid) {
      const id = checkVideoUid(uid);
      const json = await call('GET', `/${id}`);
      const result = json?.result ?? {};
      const duration = Number(result.duration);
      const code = customerCodeOf(result.thumbnail) ?? customerCodeOf(result.preview) ?? customerCodeOf(result.playback?.hls);
      return {
        uid: id,
        state: typeof result.status?.state === 'string' ? result.status.state.slice(0, 30) : '',
        readyToStream: result.readyToStream === true,
        durationSeconds: Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null,
        customerCode: code,
        errorReason: typeof result.status?.errorReasonCode === 'string' ? result.status.errorReasonCode.slice(0, 60) : null,
      };
    },

    /** Deletes a stored video. A video that no longer exists counts as deleted. */
    async deleteVideo(uid) {
      const id = checkVideoUid(uid);
      try {
        await call('DELETE', `/${id}`);
      } catch (err) {
        if (err instanceof StreamError && err.status === 404) return { deleted: true, missing: true };
        throw err;
      }
      return { deleted: true };
    },

    /** Minutes of video stored in the account, the plan's limit and the number of videos. */
    async storageUsage() {
      const json = await call('GET', '/storage-usage');
      const r = json?.result ?? {};
      const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);
      return { minutes: num(r.totalStorageMinutes), limitMinutes: num(r.totalStorageMinutesLimit), videos: num(r.videoCount) };
    },
  };
}

// ---- the client the routes use ----

let override = null;
let cached = null;

/** Tests and the local harness install a fake client here (null puts the real one back). */
export function setStreamClient(client) {
  override = client ?? null;
}

/** The Cloudflare client, or null when CF_ACCOUNT_ID / CF_STREAM_API_TOKEN are not set ("not configured"). */
export function getStreamClient() {
  if (override) return override;
  const { accountId, streamApiToken } = config.cloudflare;
  if (!accountId || !streamApiToken) return null;
  cached ??= createCloudflareStreamClient({ accountId, apiToken: streamApiToken });
  return cached;
}

export const streamConfigured = () => getStreamClient() !== null;
