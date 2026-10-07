import express from 'express';
import LiveRecording from '../../model/liveRecording.js';
import LiveSession from '../../model/liveSession.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { audit } from '../../services/audit.js';
import { customerCodeOf, getStreamClient, MAX_UPLOAD_BYTES, MAX_VIDEO_SECONDS, streamConfigured } from '../../services/cloudflareStream.js';
import { TITLE_MAX } from '../../services/liveConstants.js';
import {
  deleteVideoQuietly, recordingAdminView, refreshRecording, refreshUnfinished, resetRecordingsCache, storageSummary,
} from '../../services/liveRecordings.js';
import { bool, int, opt, parseBody, str } from '../../utils/schema.js';

// Recordings of live broadcasts (docs/LIVE.md "Recordings", docs/ADMIN.md 4.6). Mounted at /admin/live/recordings
// behind the Live router's editor check.
//
//   GET    /                    { configured, items, storage }       (unfinished uploads are checked with Cloudflare)
//   POST   /                    { sessionId, sizeBytes, durationSeconds, mimeType, title? } -> 201 { recordingId, uploadUrl, recording }
//   POST   /:id/upload-url      { sizeBytes, durationSeconds?, mimeType? }               -> { recordingId, uploadUrl, recording }
//   POST   /:id/uploaded        -> { recording }   (the browser finished the upload: "processing")
//   PATCH  /:id                 { title?, published? } -> { recording }   (published only when "ready")
//   DELETE /:id                 -> { deleted: true, cloudflareDeleted }
//
// The browser uploads the file straight to Cloudflare (tus) with `uploadUrl`; the API never sees the video. The
// upload address is given once, in the answer that created it, and is never stored or logged.
//
// Who: creating an upload (and renewing it, and saying it finished) is for the admin who started the broadcast, or an
// owner; listing, renaming, publishing and deleting are for every editor and owner.

const router = express.Router();

const NOT_CONFIGURED = 'Live broadcasting is not configured yet (CF_ACCOUNT_ID and CF_STREAM_API_TOKEN, docs/LIVE.md)';
const LIST_LIMIT = 100;
/** How long Cloudflare accepts an upload at the address it gives (a new address can be asked for after that). */
const UPLOAD_WINDOW_MS = 4 * 3600_000;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
// What MediaRecorder writes in Safari (mp4) and in Chrome, Edge and Firefox (webm), with optional codecs.
const MIME = /^video\/(mp4|webm|x-matroska)(;[ a-z0-9=.,"-]{0,80})?$/i;

const sessionIdRule = str({ min: 24, max: 24, pattern: OBJECT_ID });
const sizeRule = int({ min: 1, max: MAX_UPLOAD_BYTES });
const durationRule = int({ min: 0, max: MAX_VIDEO_SECONDS });
// express-xss-sanitizer escapes the quotes some browsers put around codec names: undo that before checking.
const mimeRule = (value, field) => str({ min: 7, max: 100, pattern: MIME })(typeof value === 'string' ? value.replace(/&quot;/g, '"') : value, field);

const idOf = (req) => {
  const id = String(req.params.id ?? '');
  return OBJECT_ID.test(id) ? id.toLowerCase() : null;
};

/** The broadcast was started by the caller, or the caller is an owner. */
const mayUpload = (req, startedById) => req.adminUser.role === 'owner' || String(startedById ?? '') === req.adminUser.id;

/** Cloudflare refuses a video longer than this: the measured length with a margin (MediaRecorder files often lack one). */
const maxDurationFor = (seconds) => Math.min(MAX_VIDEO_SECONDS, Math.max(300, Math.ceil((seconds || 0) * 1.2) + 300));

async function newUpload(req, res, { title, sizeBytes, durationSeconds }) {
  const client = getStreamClient();
  const expiresAt = new Date(Date.now() + UPLOAD_WINDOW_MS);
  try {
    const upload = await client.createUpload({
      sizeBytes,
      name: `Nazareth Holy Cross: ${title}`.slice(0, 100),
      maxDurationSeconds: maxDurationFor(durationSeconds),
      expiresAt,
    });
    return { ...upload, expiresAt };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [live] upload address refused by Cloudflare: ${err?.message ?? 'unknown error'}`);
    await audit(req, 'live.recording_failed', { type: 'liveRecording', id: '' }, { stage: 'cloudflare' });
    res.status(502).json({ error: 'Cloudflare Stream could not prepare the upload. Try again in a moment.' });
    return null;
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const docs = await LiveRecording.find({}).sort({ liveStartedAt: -1, _id: -1 }).limit(LIST_LIMIT).lean();
  const items = await refreshUnfinished(docs);
  res.json({ configured: streamConfigured(), items: items.map(recordingAdminView), storage: await storageSummary() });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = parseBody(req.body, {
    sessionId: sessionIdRule,
    sizeBytes: sizeRule,
    durationSeconds: durationRule,
    mimeType: mimeRule,
    title: opt(str({ min: 1, max: TITLE_MAX })),
  });
  if (!getStreamClient()) return res.status(503).json({ error: NOT_CONFIGURED });

  const session = await LiveSession.findById(body.sessionId.toLowerCase()).lean();
  if (!session) return res.status(404).json({ error: 'Broadcast not found' });
  if (!mayUpload(req, session.startedBy?.id)) return res.status(403).json({ error: 'Only the person who made this broadcast, or an owner, can upload its recording' });
  const existing = await LiveRecording.findOne({ session: session._id }).lean();
  if (existing) return res.status(409).json({ error: 'This broadcast already has a recording', recording: recordingAdminView(existing) });

  const title = body.title ?? session.title;
  const upload = await newUpload(req, res, { title, sizeBytes: body.sizeBytes, durationSeconds: body.durationSeconds });
  if (!upload) return undefined;

  let doc;
  try {
    doc = await LiveRecording.create({
      session: session._id,
      title,
      liveStartedAt: session.startedAt,
      liveEndedAt: session.endedAt ?? null,
      durationSeconds: body.durationSeconds,
      sizeBytes: body.sizeBytes,
      mimeType: body.mimeType,
      cfVideoUid: upload.uid,
      customerCode: customerCodeOf(session.whepUrl) ?? '',
      status: 'uploading',
      uploadExpiresAt: upload.expiresAt,
      createdBy: { id: req.adminUser.id, name: req.adminUser.username },
    });
  } catch (err) {
    await deleteVideoQuietly(upload.uid); // nothing will ever be uploaded to it
    if (err?.code === 11000) {
      const winner = await LiveRecording.findOne({ session: session._id }).lean();
      return res.status(409).json({ error: 'This broadcast already has a recording', recording: recordingAdminView(winner) });
    }
    throw err;
  }
  await audit(req, 'live.recording_create', { type: 'liveRecording', id: String(doc._id) }, {
    session: String(session._id), videoUid: upload.uid, sizeMb: Math.round(body.sizeBytes / 1048576), durationSeconds: body.durationSeconds,
  });
  return res.status(201).json({ recordingId: String(doc._id), uploadUrl: upload.uploadUrl, recording: recordingAdminView(doc) });
}));

// A new upload address for a recording whose upload did not finish (the address expired, the tab died for a day):
// the old Cloudflare video is deleted and the upload starts again from the beginning.
router.post('/:id/upload-url', asyncHandler(async (req, res) => {
  const id = idOf(req);
  if (!id) return res.status(404).json({ error: 'Recording not found' });
  const body = parseBody(req.body ?? {}, { sizeBytes: sizeRule, durationSeconds: opt(durationRule), mimeType: opt(mimeRule) });
  if (!getStreamClient()) return res.status(503).json({ error: NOT_CONFIGURED });
  const doc = await LiveRecording.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Recording not found' });
  const session = await LiveSession.findById(String(doc.session)).lean();
  if (!mayUpload(req, session?.startedBy?.id ?? doc.createdBy?.id)) return res.status(403).json({ error: 'Only the person who made this broadcast, or an owner, can upload its recording' });
  if (!['uploading', 'failed'].includes(doc.status)) return res.status(409).json({ error: 'This recording has already been uploaded', recording: recordingAdminView(doc) });

  const durationSeconds = body.durationSeconds ?? doc.durationSeconds;
  const upload = await newUpload(req, res, { title: doc.title, sizeBytes: body.sizeBytes, durationSeconds });
  if (!upload) return undefined;
  const updated = await LiveRecording.findOneAndUpdate(
    { _id: doc._id, status: doc.status, cfVideoUid: doc.cfVideoUid },
    {
      $set: {
        cfVideoUid: upload.uid, status: 'uploading', failReason: null, published: false, publishedAt: null, sizeBytes: body.sizeBytes, durationSeconds,
        ...(body.mimeType ? { mimeType: body.mimeType } : {}), uploadExpiresAt: upload.expiresAt, checkedAt: null,
      },
    },
    { new: true },
  ).lean();
  if (!updated) {
    await deleteVideoQuietly(upload.uid); // someone else changed it in the meantime
    return res.status(409).json({ error: 'The recording changed in the meantime. Reload the page.' });
  }
  const oldDeleted = await deleteVideoQuietly(doc.cfVideoUid);
  resetRecordingsCache();
  await audit(req, 'live.recording_renew', { type: 'liveRecording', id: String(doc._id) }, { videoUid: upload.uid, oldVideoUid: doc.cfVideoUid, oldDeleted });
  return res.json({ recordingId: String(doc._id), uploadUrl: upload.uploadUrl, recording: recordingAdminView(updated) });
}));

router.post('/:id/uploaded', asyncHandler(async (req, res) => {
  const id = idOf(req);
  if (!id) return res.status(404).json({ error: 'Recording not found' });
  parseBody(req.body ?? {}, {});
  const doc = await LiveRecording.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Recording not found' });
  const session = await LiveSession.findById(String(doc.session)).lean();
  if (!mayUpload(req, session?.startedBy?.id ?? doc.createdBy?.id)) return res.status(403).json({ error: 'Only the person who made this broadcast, or an owner, can upload its recording' });
  if (doc.status !== 'uploading') {
    if (doc.status === 'failed') return res.status(409).json({ error: 'This recording failed. Upload it again.', recording: recordingAdminView(doc) });
    return res.json({ recording: recordingAdminView(doc) }); // said twice: nothing to do
  }
  const updated = await LiveRecording.findOneAndUpdate({ _id: doc._id, status: 'uploading' }, { $set: { status: 'processing', checkedAt: null } }, { new: true }).lean();
  await audit(req, 'live.recording_uploaded', { type: 'liveRecording', id: String(doc._id) }, { videoUid: doc.cfVideoUid });
  // Cloudflare may already be done with a short video.
  const checked = updated ? await refreshRecording(updated) : doc;
  return res.json({ recording: recordingAdminView(checked) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = idOf(req);
  if (!id) return res.status(404).json({ error: 'Recording not found' });
  const body = parseBody(req.body, { title: opt(str({ min: 1, max: TITLE_MAX })), published: opt(bool()) });
  if (body.title === undefined && body.published === undefined) return res.status(400).json({ error: 'Nothing to change' });
  let doc = await LiveRecording.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Recording not found' });
  if (body.published === true && doc.status !== 'ready') {
    doc = await refreshRecording(doc); // it may have become ready a moment ago
    if (doc.status !== 'ready') return res.status(409).json({ error: 'The recording is not ready yet: it can be published once Cloudflare has processed it', recording: recordingAdminView(doc) });
  }
  const set = {};
  if (body.title !== undefined) set.title = body.title;
  if (body.published !== undefined && body.published !== doc.published) {
    set.published = body.published;
    set.publishedAt = body.published ? new Date() : null;
  }
  const filter = body.published === true ? { _id: doc._id, status: 'ready' } : { _id: doc._id };
  const updated = Object.keys(set).length ? await LiveRecording.findOneAndUpdate(filter, { $set: set }, { new: true }).lean() : doc;
  if (!updated) return res.status(409).json({ error: 'The recording changed in the meantime. Reload the page.' });
  resetRecordingsCache();
  await audit(req, 'live.recording_update', { type: 'liveRecording', id: String(doc._id) }, {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.published !== undefined ? { published: body.published } : {}),
  });
  return res.json({ recording: recordingAdminView(updated) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = idOf(req);
  if (!id) return res.status(404).json({ error: 'Recording not found' });
  const doc = await LiveRecording.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Recording not found' });
  const removed = await LiveRecording.deleteOne({ _id: doc._id });
  if (!removed?.deletedCount) return res.status(404).json({ error: 'Recording not found' });
  resetRecordingsCache();
  const cloudflareDeleted = await deleteVideoQuietly(doc.cfVideoUid);
  await audit(req, 'live.recording_delete', { type: 'liveRecording', id: String(doc._id) }, {
    title: doc.title, videoUid: doc.cfVideoUid, published: Boolean(doc.published), cloudflareDeleted,
  });
  return res.json({ deleted: true, cloudflareDeleted });
}));

export default router;
