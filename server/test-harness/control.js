// Test hooks of the local harness, mounted at /__harness ONLY when HARNESS=1 (serve.mjs). They exist so end-to-end
// tests can start from a known state and read what the fake mailer recorded. They are not part of the API and are
// refused from any address that is not this machine.
import express from 'express';
import { clearData, models, state } from './harness-models.js';
import { seed } from './seed.mjs';

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
  return router;
}
