import express from 'express';
import mongoose from 'mongoose';
import ScheduledBroadcast from '../../model/scheduledBroadcast.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { audit } from '../../services/audit.js';
import { DESCRIPTION_MAX, NAZARETH_TIME_ZONE, TITLE_MAX } from '../../services/liveConstants.js';
import { MAX_AHEAD_MS, nazarethToUtc, resetScheduleCache, scheduleAdminView } from '../../services/liveSchedule.js';
import { HttpError } from '../../utils/httpError.js';
import { bool, oneOf, opt, parseBody, str } from '../../utils/schema.js';

// Scheduled broadcasts (docs/LIVE.md "Scheduled broadcasts", docs/ADMIN.md 4.6). Mounted at /admin/live/schedule
// behind the Live router's editor check.
//
//   GET    /       { timeZone, items }   (live ones, and everything that starts from 7 days ago on, soonest first)
//   POST   /       { title, description?, startsAtLocal, published? }                    -> 201 { item }
//   PATCH  /:id    { title?, description?, startsAtLocal?, published?, status? }          -> { item }
//   DELETE /:id    -> { deleted: true }
//
// `startsAtLocal` is the date and time in NAZARETH ("2026-10-20T19:30", what <input type="datetime-local"> gives); the
// API converts it to UTC (services/liveSchedule.js; the two days a year the clock changes are handled there). `status`
// can only be set to "cancelled" or back to "scheduled"; "live" and "done" come from starting and ending a broadcast.

const router = express.Router();

const LIST_LIMIT = 100;
const LIST_FROM_MS = 7 * 24 * 3600_000;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
/** A broadcast may be scheduled from one minute in the past (the time it takes to fill in the form) on. */
const PAST_TOLERANCE_MS = 60_000;

const idOf = (req) => {
  const id = String(req.params.id ?? '');
  return OBJECT_ID.test(id) ? id.toLowerCase() : null;
};

function startsAtFrom(local, now = Date.now()) {
  const date = nazarethToUtc(local);
  if (!date) throw new HttpError(400, 'Invalid startsAtLocal: a date and time like 2026-10-20T19:30 (Nazareth time)');
  if (date.getTime() < now - PAST_TOLERANCE_MS) throw new HttpError(400, 'Invalid startsAtLocal: the time has already passed');
  if (date.getTime() > now + MAX_AHEAD_MS) throw new HttpError(400, 'Invalid startsAtLocal: at most a year ahead');
  return date;
}

const localRule = str({ min: 16, max: 16, pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ });
const descriptionRule = str({ min: 0, max: DESCRIPTION_MAX, multiline: true });

router.get('/', asyncHandler(async (req, res) => {
  const items = await ScheduledBroadcast.find({
    $or: [{ status: 'live' }, { startsAt: mongoose.trusted({ $gte: new Date(Date.now() - LIST_FROM_MS) }) }],
  }).sort({ startsAt: 1, _id: 1 }).limit(LIST_LIMIT).lean();
  res.json({ timeZone: NAZARETH_TIME_ZONE, items: items.map(scheduleAdminView) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = parseBody(req.body, {
    title: str({ min: 1, max: TITLE_MAX }),
    description: opt(descriptionRule),
    startsAtLocal: localRule,
    published: opt(bool()),
  });
  const startsAt = startsAtFrom(body.startsAtLocal);
  const who = { id: req.adminUser.id, name: req.adminUser.username };
  const doc = await ScheduledBroadcast.create({
    title: body.title,
    description: body.description ?? '',
    startsAt,
    published: body.published ?? false,
    status: 'scheduled',
    liveSession: null,
    createdBy: who,
    updatedBy: who,
  });
  resetScheduleCache();
  await audit(req, 'live.schedule_create', { type: 'scheduledBroadcast', id: String(doc._id) }, {
    title: doc.title, startsAt: startsAt.toISOString(), published: Boolean(doc.published),
  });
  return res.status(201).json({ item: scheduleAdminView(doc) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = idOf(req);
  if (!id) return res.status(404).json({ error: 'Scheduled broadcast not found' });
  const body = parseBody(req.body, {
    title: opt(str({ min: 1, max: TITLE_MAX })),
    description: opt(descriptionRule),
    startsAtLocal: opt(localRule),
    published: opt(bool()),
    status: opt(oneOf(['scheduled', 'cancelled'])),
  });
  if (Object.keys(body).length === 0) return res.status(400).json({ error: 'Nothing to change' });
  const doc = await ScheduledBroadcast.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Scheduled broadcast not found' });

  const set = {};
  if (body.title !== undefined) set.title = body.title;
  if (body.description !== undefined) set.description = body.description;
  if (body.published !== undefined) set.published = body.published;
  // The time and the status belong to a broadcast that has not happened: a live or finished one keeps them.
  if (body.startsAtLocal !== undefined || body.status !== undefined) {
    if (!['scheduled', 'cancelled'].includes(doc.status)) {
      return res.status(409).json({ error: 'This broadcast has already started: its time and status can no longer be changed', item: scheduleAdminView(doc) });
    }
    if (body.startsAtLocal !== undefined) set.startsAt = startsAtFrom(body.startsAtLocal);
    if (body.status !== undefined) set.status = body.status;
  }
  set.updatedBy = { id: req.adminUser.id, name: req.adminUser.username };

  const updated = await ScheduledBroadcast.findOneAndUpdate({ _id: doc._id, status: doc.status }, { $set: set }, { new: true }).lean();
  if (!updated) return res.status(409).json({ error: 'The broadcast changed in the meantime. Reload the page.' });
  resetScheduleCache();
  const meta = {};
  for (const key of ['title', 'published', 'status']) if (set[key] !== undefined) meta[key] = set[key];
  if (set.description !== undefined) meta.description = true;
  if (set.startsAt) meta.startsAt = set.startsAt.toISOString();
  await audit(req, 'live.schedule_update', { type: 'scheduledBroadcast', id: String(doc._id) }, meta);
  return res.json({ item: scheduleAdminView(updated) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = idOf(req);
  if (!id) return res.status(404).json({ error: 'Scheduled broadcast not found' });
  const doc = await ScheduledBroadcast.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Scheduled broadcast not found' });
  if (doc.status === 'live') return res.status(409).json({ error: 'This broadcast is live now. End it first.' });
  const removed = await ScheduledBroadcast.deleteOne({ _id: doc._id, status: doc.status });
  if (!removed?.deletedCount) return res.status(409).json({ error: 'The broadcast changed in the meantime. Reload the page.' });
  resetScheduleCache();
  await audit(req, 'live.schedule_delete', { type: 'scheduledBroadcast', id: String(doc._id) }, {
    title: doc.title, startsAt: new Date(doc.startsAt).toISOString(), status: doc.status,
  });
  return res.json({ deleted: true });
}));

export default router;
