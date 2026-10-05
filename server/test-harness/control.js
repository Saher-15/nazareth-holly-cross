// Test hooks of the local harness, mounted at /__harness ONLY when HARNESS=1 (serve.mjs). They exist so end-to-end
// tests can start from a known state and read what the fake mailer recorded. They are not part of the API and are
// refused from any address that is not this machine.
import express from 'express';
import { clearData, state } from './harness-models.js';
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
  router.post('/reset', async (req, res, next) => {
    try {
      clearData();
      state.failMail = false;
      res.json({ ok: true, ...(await seed()) });
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
