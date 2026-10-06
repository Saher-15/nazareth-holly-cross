import crypto from 'node:crypto';
import { StreamError } from '../services/cloudflareStream.js';

// A stand-in for the Cloudflare Stream client (services/cloudflareStream.js), for the server tests and the local
// harness: nothing here opens a network connection. It answers with addresses of the same shape as Cloudflare's:
//
//   whipUrl  https://customer-<code>.cloudflarestream.com/<64 hex secret>/webRTC/publish
//   whepUrl  https://customer-<code>.cloudflarestream.com/<input uid>/webRTC/play
//
// Install it with setStreamClient(fakeStreamClient()). `fail.create` / `fail.delete` make the next calls fail like a
// Cloudflare outage; `inputs` holds the inputs that exist; `calls` records every call.
export function fakeStreamClient({ customerCode = 'fake0test' } = {}) {
  const host = `https://customer-${customerCode}.cloudflarestream.com`;
  const client = {
    inputs: new Map(), // uid -> { name, whipUrl, whepUrl }
    calls: [],
    fail: { create: false, delete: false },
    async createLiveInput({ name = '' } = {}) {
      client.calls.push({ op: 'create', name });
      if (client.fail.create) throw new StreamError('Cloudflare Stream POST /live_inputs failed (500): 10000 fake outage', { status: 500 });
      const uid = crypto.randomBytes(16).toString('hex');
      const secret = crypto.randomBytes(32).toString('hex');
      const input = { name, whipUrl: `${host}/${secret}/webRTC/publish`, whepUrl: `${host}/${uid}/webRTC/play` };
      client.inputs.set(uid, input);
      return { uid, whipUrl: input.whipUrl, whepUrl: input.whepUrl };
    },
    async deleteLiveInput(uid) {
      client.calls.push({ op: 'delete', uid });
      if (client.fail.delete) throw new StreamError(`Cloudflare Stream DELETE /live_inputs/${uid} failed (500): fake outage`, { status: 500 });
      const existed = client.inputs.delete(uid);
      return existed ? { deleted: true } : { deleted: true, missing: true };
    },
    reset() {
      client.inputs.clear();
      client.calls.length = 0;
      client.fail.create = false;
      client.fail.delete = false;
    },
  };
  return client;
}
