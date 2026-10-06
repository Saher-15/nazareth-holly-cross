import crypto from 'node:crypto';
import { StreamError } from '../services/cloudflareStream.js';

// A stand-in for the Cloudflare Stream client (services/cloudflareStream.js), for the server tests and the local
// harness: nothing here opens a network connection. It answers with addresses of the same shape as Cloudflare's:
//
//   whipUrl    https://customer-<code>.cloudflarestream.com/<64 hex secret>/webRTC/publish
//   whepUrl    https://customer-<code>.cloudflarestream.com/<input uid>/webRTC/play
//   uploadUrl  https://upload.videodelivery.net/tus/<video uid>?tusv2=true   (one-time tus upload address)
//
// Nothing is ever uploaded to the fake upload address: the dashboard's end-to-end tests answer it inside the browser
// (Playwright routes), and a test moves a video through Cloudflare's processing states with setVideoState().
//
// Install it with setStreamClient(fakeStreamClient()). `fail.*` make the next calls fail like a Cloudflare outage;
// `inputs` holds the live inputs that exist, `videos` the stored videos; `calls` records every call.
export function fakeStreamClient({ customerCode = 'fake0test', storageLimitMinutes = 1000 } = {}) {
  const host = `https://customer-${customerCode}.cloudflarestream.com`;
  const outage = (what) => new StreamError(`Cloudflare Stream ${what} failed (500): 10000 fake outage`, { status: 500 });
  const client = {
    inputs: new Map(), // uid -> { name, whipUrl, whepUrl }
    videos: new Map(), // uid -> { name, sizeBytes, maxDurationSeconds, expiresAt, state, readyToStream, durationSeconds }
    calls: [],
    fail: { create: false, delete: false, upload: false, getVideo: false, deleteVideo: false, storage: false },
    async createLiveInput({ name = '' } = {}) {
      client.calls.push({ op: 'create', name });
      if (client.fail.create) throw outage('POST /live_inputs');
      const uid = crypto.randomBytes(16).toString('hex');
      const secret = crypto.randomBytes(32).toString('hex');
      const input = { name, whipUrl: `${host}/${secret}/webRTC/publish`, whepUrl: `${host}/${uid}/webRTC/play` };
      client.inputs.set(uid, input);
      return { uid, whipUrl: input.whipUrl, whepUrl: input.whepUrl };
    },
    async deleteLiveInput(uid) {
      client.calls.push({ op: 'delete', uid });
      if (client.fail.delete) throw outage(`DELETE /live_inputs/${uid}`);
      const existed = client.inputs.delete(uid);
      return existed ? { deleted: true } : { deleted: true, missing: true };
    },
    async createUpload({ sizeBytes, name = '', maxDurationSeconds, expiresAt } = {}) {
      client.calls.push({ op: 'createUpload', sizeBytes, name, maxDurationSeconds });
      if (client.fail.upload) throw outage('POST ?direct_user=true');
      if (!Number.isInteger(sizeBytes) || sizeBytes < 1) throw new StreamError('Invalid upload size');
      const uid = crypto.randomBytes(16).toString('hex');
      client.videos.set(uid, { name, sizeBytes, maxDurationSeconds, expiresAt: expiresAt ?? null, state: 'pendingupload', readyToStream: false, durationSeconds: null });
      return { uid, uploadUrl: `https://upload.videodelivery.net/tus/${uid}?tusv2=true` };
    },
    async getVideo(uid) {
      client.calls.push({ op: 'getVideo', uid });
      if (client.fail.getVideo) throw outage(`GET /${uid}`);
      const video = client.videos.get(uid);
      if (!video) throw new StreamError(`Cloudflare Stream GET /${uid} failed (404): 10005 not found`, { status: 404 });
      return { uid, state: video.state, readyToStream: video.readyToStream, durationSeconds: video.durationSeconds, customerCode, errorReason: video.state === 'error' ? 'ERR_NON_VIDEO' : null };
    },
    async deleteVideo(uid) {
      client.calls.push({ op: 'deleteVideo', uid });
      if (client.fail.deleteVideo) throw outage(`DELETE /${uid}`);
      const existed = client.videos.delete(uid);
      return existed ? { deleted: true } : { deleted: true, missing: true };
    },
    async storageUsage() {
      client.calls.push({ op: 'storage' });
      if (client.fail.storage) throw outage('GET /storage-usage');
      const seconds = [...client.videos.values()].reduce((sum, v) => sum + (v.durationSeconds ?? 0), 0);
      return { minutes: Math.round(seconds / 60), limitMinutes: storageLimitMinutes, videos: client.videos.size };
    },
    /** Moves a video through Cloudflare's states: 'pendingupload', 'queued', 'inprogress', 'ready', 'error'. */
    setVideoState(uid, state, { durationSeconds } = {}) {
      const video = client.videos.get(uid);
      if (!video) return false;
      video.state = state;
      video.readyToStream = state === 'ready';
      if (durationSeconds !== undefined) video.durationSeconds = durationSeconds;
      else if (state === 'ready' && video.durationSeconds === null) video.durationSeconds = Math.min(video.maxDurationSeconds ?? 60, 60);
      return true;
    },
    reset() {
      client.inputs.clear();
      client.videos.clear();
      client.calls.length = 0;
      for (const key of Object.keys(client.fail)) client.fail[key] = false;
    },
  };
  return client;
}
