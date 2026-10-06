import { config } from '../config/env.js';

// Cloudflare Stream, WebRTC mode (docs/LIVE.md): https://developers.cloudflare.com/stream/webrtc-beta/
//
//   createLiveInput()  POST   /accounts/{account}/stream/live_inputs        -> { uid, whipUrl, whepUrl }
//   deleteLiveInput()  DELETE /accounts/{account}/stream/live_inputs/{uid}
//
// The browser of the admin publishes to `whipUrl` (WHIP); viewers play `whepUrl` (WHEP) or the Stream player page
// derived from it (playerUrl). WebRTC inputs have no recording, no HLS and no viewer counts.
//
// Secrets: the API token goes only into the Authorization header of a request to api.cloudflare.com. The WHIP address
// contains the input's broadcast secret: it is returned to the caller and never logged here (errors carry Cloudflare's
// status and error codes only, never a URL that Cloudflare returned and never a header).
//
// The client is injectable: tests and the local harness install a fake with setStreamClient() (test-harness/
// fake-cloudflare.js), so nothing in a test ever reaches the network.

export const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 15_000;

/** A Stream host of a Cloudflare customer: customer-<code>.cloudflarestream.com. */
export const STREAM_HOST = /^customer-[a-z0-9]{1,64}\.cloudflarestream\.com$/;
const INPUT_UID = /^[a-f0-9]{32}$/;
const PATH_SEGMENT = /^[A-Za-z0-9_-]{1,256}$/;

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

  async function call(method, path, body) {
    let res;
    try {
      res = await fetchImpl(`${accountPath}${path}`, {
        method,
        headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new StreamError(`Cloudflare Stream is unreachable (${err?.name === 'TimeoutError' ? 'timeout' : 'network error'})`);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success === false) {
      const detail = describeErrors(json);
      // The path names the input id at most (public: it is part of every viewer's playback address).
      throw new StreamError(`Cloudflare Stream ${method} ${path} failed (${res.status})${detail ? `: ${detail}` : ''}`, { status: res.status });
    }
    return json;
  }

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
