// Test hooks of the local harness, mounted at /__harness ONLY when HARNESS=1 (serve.mjs). They exist so end-to-end
// tests can start from a known state and read what the fake mailer recorded. They are not part of the API and are
// refused from any address that is not this machine.
import express from 'express';
import { clearData, models, state } from './harness-models.js';
import { seed } from './seed.mjs';
import { setStreamClient } from '../services/cloudflareStream.js';
import { resetLiveStatusCache } from '../services/live.js';
import { resetRecordingsCache, resetStorageCache } from '../services/liveRecordings.js';
import { resetScheduleCache } from '../services/liveSchedule.js';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function controlRouter() {
  if (process.env.HARNESS !== '1') throw new Error('The harness control routes need HARNESS=1');
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!LOOPBACK.has(req.socket.remoteAddress)) return res.status(403).json({ error: 'Forbidden' });
    return next();
  });
  router.use(express.json({ limit: '2kb' }));

  router.get('/health', (req, res) => res.json({ ok: true, harness: true }));
  // Back to the seed: every collection, every account (locks, sessions, TOTP) and every rate-limit counter.
  // { "accounts": false } leaves no admin account at all (the state before the first owner exists), so the creation
  // of the first owner by a password-reset request can be tested.
  router.post('/reset', async (req, res, next) => {
    try {
      clearData();
      state.failMail = false;
      state.stream?.reset();
      if (state.stream) setStreamClient(state.stream);
      resetLiveStatusCache();
      resetRecordingsCache();
      resetStorageCache();
      resetScheduleCache();
      const seeded = await seed();
      if (req.body?.accounts === false) models.Admin.resetData();
      res.json({ ok: true, ...seeded, ...(req.body?.accounts === false ? { accounts: 0 } : {}) });
    } catch (error) {
      next(error);
    }
  });
  // The mails the fake mailer was asked to send.
  router.get('/emails', (req, res) => res.json(state.emails));
  // { fail: true } makes the mailer fail like an SMTP outage (the order answer then says emailSent: false).
  router.post('/mail', (req, res) => {
    state.failMail = req.body?.fail === true;
    res.json({ ok: true, fail: state.failMail });
  });
  // Live broadcasting: { configured: false } behaves like a server without CF_ACCOUNT_ID / CF_STREAM_API_TOKEN;
  // { failCreate: true } makes the fake Cloudflare refuse to create an input (an outage), { failUpload: true } refuse
  // an upload address. Recordings: { videoState: 'queued' | 'inprogress' | 'ready' | 'error', videoUid?, durationSeconds? }
  // moves a stored video (every video when no uid is given) through Cloudflare's processing, as if it had been uploaded.
  const VIDEO_STATES = ['pendingupload', 'queued', 'inprogress', 'ready', 'error'];
  const liveState = () => ({
    ok: true,
    inputs: state.stream ? state.stream.inputs.size : 0,
    videos: state.stream ? [...state.stream.videos.entries()].map(([uid, v]) => ({ uid, state: v.state, sizeBytes: v.sizeBytes })) : [],
  });
  router.get('/live', (req, res) => res.json(liveState()));
  router.post('/live', (req, res) => {
    if (typeof req.body?.configured === 'boolean') setStreamClient(req.body.configured ? state.stream : null);
    if (typeof req.body?.failCreate === 'boolean' && state.stream) state.stream.fail.create = req.body.failCreate;
    if (typeof req.body?.failUpload === 'boolean' && state.stream) state.stream.fail.upload = req.body.failUpload;
    if (VIDEO_STATES.includes(req.body?.videoState) && state.stream) {
      const duration = Number.isInteger(req.body.durationSeconds) && req.body.durationSeconds >= 0 ? req.body.durationSeconds : undefined;
      const uids = typeof req.body.videoUid === 'string' ? [req.body.videoUid] : [...state.stream.videos.keys()];
      for (const uid of uids) state.stream.setVideoState(uid, req.body.videoState, { durationSeconds: duration });
    }
    resetLiveStatusCache();
    resetRecordingsCache();
    resetStorageCache();
    resetScheduleCache();
    res.json(liveState());
  });
  return router;
}
