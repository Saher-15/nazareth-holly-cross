import express from 'express';
import LiveSession from '../../model/liveSession.js';
import ScheduledBroadcast from '../../model/scheduledBroadcast.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { audit } from '../../services/audit.js';
import { getStreamClient, streamConfigured } from '../../services/cloudflareStream.js';
import { adminView, deleteInputQuietly, endSession, endStaleSessions, LIVE_MAX_MS, resetLiveStatusCache } from '../../services/live.js';
import { resetScheduleCache } from '../../services/liveSchedule.js';
import { bool, opt, parseBody, str } from '../../utils/schema.js';
import recordingsRouter from './liveRecordings.js';
import scheduleRouter from './liveSchedule.js';

// Live broadcasting from the dashboard (docs/LIVE.md, docs/ADMIN.md "Live"). Editor or owner on every route.
//
//   GET  /admin/live         { configured, maxMinutes, current, history }
//   POST /admin/live/start   { title, scheduleId? }   -> 201 { session, whipUrl }   (409 while another one is live)
//   POST /admin/live/stop    { sessionId?, force?, failed? }   -> { stopped, session }
//        failed: true = the camera never reached Cloudflare (the dashboard ends it at once): recorded as endReason 'failed'
//   /admin/live/recordings   the recordings of past broadcasts (route/admin/liveRecordings.js)
//   /admin/live/schedule     broadcasts announced ahead (route/admin/liveSchedule.js)
//
// `whipUrl` (Cloudflare's publish address, with the input's broadcast secret in it) is in exactly one answer: the
// start of the session, to the admin who started it. It is not stored, not logged and not in any other answer.
// `scheduleId` names the scheduled broadcast this one fulfils: it becomes "live", and "done" when the session ends.

const router = express.Router();
router.use(requireRole('editor'));
router.use('/recordings', recordingsRouter);
router.use('/schedule', scheduleRouter);

const NOT_CONFIGURED = 'Live broadcasting is not configured yet (CF_ACCOUNT_ID and CF_STREAM_API_TOKEN, docs/LIVE.md)';
const HISTORY = 10;

router.get('/', asyncHandler(async (req, res) => {
  await endStaleSessions();
  const [current, history] = await Promise.all([
    LiveSession.findOne({ status: 'live' }).lean(),
    LiveSession.find({}).sort({ startedAt: -1, _id: -1 }).limit(HISTORY).lean(),
  ]);
  res.json({ configured: streamConfigured(), maxMinutes: LIVE_MAX_MS / 60_000, current: adminView(current), history: history.map(adminView) });
}));

router.post('/start', asyncHandler(async (req, res) => {
  const { title, scheduleId } = parseBody(req.body, {
    title: str({ min: 1, max: 120 }),
    scheduleId: opt(str({ min: 24, max: 24, pattern: /^[a-f0-9]{24}$/i })),
  });
  // Answered here, not thrown: the error handler hides the text of every 5xx in production.
  const client = getStreamClient();
  if (!client) return res.status(503).json({ error: NOT_CONFIGURED });

  await endStaleSessions();
  const current = await LiveSession.findOne({ status: 'live' }).lean();
  if (current) return res.status(409).json({ error: 'A broadcast is already live', current: adminView(current) });

  // The scheduled broadcast this one fulfils, checked before Cloudflare is asked for anything.
  if (scheduleId) {
    const planned = await ScheduledBroadcast.findById(scheduleId.toLowerCase()).lean();
    if (!planned) return res.status(404).json({ error: 'Scheduled broadcast not found' });
    if (planned.status !== 'scheduled') return res.status(409).json({ error: 'That scheduled broadcast is not waiting to start (it is live, done or cancelled)' });
  }

  let input;
  try {
    input = await client.createLiveInput({ name: `Nazareth Holy Cross live ${new Date().toISOString().slice(0, 16)}` });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [live] start refused by Cloudflare: ${err?.message ?? 'unknown error'}`);
    await audit(req, 'live.start_failed', { type: 'live', id: '' }, { stage: 'cloudflare' });
    return res.status(502).json({ error: 'Cloudflare Stream could not prepare the broadcast. Try again in a moment.' });
  }

  let session;
  try {
    session = await LiveSession.create({
      title,
      status: 'live',
      inputUid: input.uid,
      whepUrl: input.whepUrl,
      startedAt: new Date(),
      startedBy: { id: req.adminUser.id, name: req.adminUser.username },
    });
  } catch (err) {
    await deleteInputQuietly(input.uid); // nothing will ever publish to it
    // The unique "one live session" index: someone else started at the same moment.
    if (err?.code === 11000) {
      const winner = await LiveSession.findOne({ status: 'live' }).lean();
      return res.status(409).json({ error: 'A broadcast is already live', current: adminView(winner) });
    }
    throw err;
  }

  resetLiveStatusCache();
  let linked = false;
  if (scheduleId) {
    // Only an item still waiting is linked (two admins choosing the same one at the same moment: the first wins).
    linked = Boolean(await ScheduledBroadcast.findOneAndUpdate(
      { _id: scheduleId.toLowerCase(), status: 'scheduled' },
      { $set: { status: 'live', liveSession: session._id } },
      { new: true },
    ).lean());
    if (linked) resetScheduleCache();
  }
  await audit(req, 'live.start', { type: 'live', id: String(session._id) }, {
    title: session.title, inputUid: input.uid, ...(scheduleId ? { scheduleId: scheduleId.toLowerCase(), scheduleLinked: linked } : {}),
  });
  return res.status(201).json({ session: adminView(session), whipUrl: input.whipUrl });
}));

router.post('/stop', asyncHandler(async (req, res) => {
  const body = parseBody(req.body ?? {}, { sessionId: opt(str({ min: 24, max: 24, pattern: /^[a-f0-9]{24}$/i })), force: opt(bool()), failed: opt(bool()) });
  const current = await LiveSession.findOne({ status: 'live' }).lean();
  // Nothing live, or the caller means a session that already ended (a late "stop" from a closed tab must never end the
  // NEXT broadcast): nothing to do.
  if (!current || (body.sessionId && String(current._id) !== body.sessionId.toLowerCase())) return res.json({ stopped: false, session: null });

  const mine = String(current.startedBy?.id ?? '') === req.adminUser.id;
  if (!mine) {
    if (req.adminUser.role !== 'owner') return res.status(403).json({ error: 'Only the person who started this broadcast, or an owner, can end it' });
    if (body.force !== true) return res.status(409).json({ error: 'Someone else started this broadcast. Confirm to end it.', current: adminView(current) });
  }
  // A broadcast whose camera never connected is "failed", not "ended" (review 04 finding 16); only its starter can say so.
  const reason = !mine ? 'forced' : body.failed === true ? 'failed' : 'stopped';
  const ended = await endSession(current, { reason, user: req.adminUser, req });
  return res.json({ stopped: Boolean(ended), session: adminView(ended) });
}));

export default router;
