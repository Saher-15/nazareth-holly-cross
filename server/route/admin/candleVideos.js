import express from 'express';
import CandleVideo from '../../model/candleVideo.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { audit } from '../../services/audit.js';
import {
  candleVideoAdminView, MAX_CANDLE_VIDEO_BYTES, MAX_CANDLE_VIDEO_SECONDS, MAX_CANDLE_VIDEOS, refreshCandleVideo, resetCandleVideosCache,
} from '../../services/candleVideos.js';
import { getStreamClient, streamConfigured } from '../../services/cloudflareStream.js';
import { TITLE_MAX } from '../../services/liveConstants.js';
import { deleteVideoQuietly } from '../../services/liveRecordings.js';
import { bool, int, opt, parseBody, str } from '../../utils/schema.js';

// /admin/candle-videos (docs/ADMIN.md 5.5): the videos of the website's candle page. Every role reads the list; an editor
// or an owner adds, renames, publishes and deletes. The file goes from the browser straight to Cloudflare Stream with a
// one-time tus address (as the broadcast recordings, docs/LIVE.md):
//   POST   /                  { title, sizeBytes, mimeType }  -> { video, uploadUrl }
//   POST   /:id/upload-url    { sizeBytes }                   -> { video, uploadUrl }   a new address (the old one expired)
//   POST   /:id/uploaded      {}                              -> { video }              the browser finished: ask Cloudflare
//   PATCH  /:id               { title?, published? }          -> { video }              published only once it is ready
//   DELETE /:id                                               -> { deleted: true }      also deletes it at Cloudflare
const router = express.Router();

const NOT_CONFIGURED = 'Video uploads are not set up yet (CF_ACCOUNT_ID and CF_STREAM_API_TOKEN, docs/LIVE.md)';
const UPLOAD_WINDOW_MS = 4 * 3600_000;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
// Phones film in MP4 or QuickTime; Cloudflare Stream encodes all of these.
const MIME = /^video\/(mp4|webm|quicktime|x-matroska)(;[ a-z0-9=.,"-]{0,80})?$/i;
const titleRule = str({ min: 1, max: TITLE_MAX });
const sizeRule = int({ min: 1, max: MAX_CANDLE_VIDEO_BYTES });
const mimeRule = (value, field) => str({ min: 7, max: 100, pattern: MIME })(typeof value === 'string' ? value.replace(/&quot;/g, '"') : value, field);
const idOf = (req) => {
  const id = String(req.params.id ?? '');
  return OBJECT_ID.test(id) ? id.toLowerCase() : null;
};
const who = (req) => ({ id: req.adminUser.id, name: req.adminUser.username });

async function newUpload(req, res, { title, sizeBytes }) {
  const expiresAt = new Date(Date.now() + UPLOAD_WINDOW_MS);
  try {
    const upload = await getStreamClient().createUpload({
      sizeBytes, name: `Nazareth Holy Cross candle page: ${title}`.slice(0, 100), maxDurationSeconds: MAX_CANDLE_VIDEO_SECONDS, expiresAt,
    });
    return { ...upload, expiresAt };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [candle-videos] upload address refused by Cloudflare: ${err?.message ?? 'unknown error'}`);
    res.status(502).json({ error: 'Cloudflare Stream could not prepare the upload. Try again in a moment.' });
    return null;
  }
}

router.get('/', requireRole('viewer'), asyncHandler(async (req, res) => {
  const docs = await CandleVideo.find({}).sort({ createdAt: -1, _id: -1 }).limit(MAX_CANDLE_VIDEOS * 2).lean();
  const items = [];
  for (const doc of docs) items.push(['uploading', 'processing'].includes(doc.status) ? await refreshCandleVideo(doc) : doc);
  res.json({ configured: streamConfigured(), max: MAX_CANDLE_VIDEOS, maxBytes: MAX_CANDLE_VIDEO_BYTES, items: items.map(candleVideoAdminView) });
}));

router.post('/', requireRole('editor'), asyncHandler(async (req, res) => {
  const body = parseBody(req.body, { title: titleRule, sizeBytes: sizeRule, mimeType: mimeRule });
  if (!getStreamClient()) return res.status(503).json({ error: NOT_CONFIGURED });
  if (await CandleVideo.countDocuments({}) >= MAX_CANDLE_VIDEOS) {
    return res.status(409).json({ error: `At most ${MAX_CANDLE_VIDEOS} videos: delete one first` });
  }
  const upload = await newUpload(req, res, body);
  if (!upload) return undefined;
  const doc = await CandleVideo.create({
    title: body.title, cfVideoUid: upload.uid, status: 'uploading', sizeBytes: body.sizeBytes, uploadExpiresAt: upload.expiresAt, createdBy: who(req),
  });
  await audit(req, 'candle_video.create', { type: 'candleVideo', id: String(doc._id) }, { title: body.title, sizeBytes: body.sizeBytes });
  return res.status(201).json({ video: candleVideoAdminView(doc.toObject ? doc.toObject() : doc), uploadUrl: upload.uploadUrl });
}));

router.post('/:id/upload-url', requireRole('editor'), asyncHandler(async (req, res) => {
  const id = idOf(req);
  if (!id) return res.status(404).json({ error: 'Video not found' });
  const body = parseBody(req.body ?? {}, { sizeBytes: sizeRule });
  if (!getStreamClient()) return res.status(503).json({ error: NOT_CONFIGURED });
  const doc = await CandleVideo.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Video not found' });
  if (!['uploading', 'failed'].includes(doc.status)) return res.status(409).json({ error: 'This video has already been uploaded', video: candleVideoAdminView(doc) });
  const upload = await newUpload(req, res, { title: doc.title, sizeBytes: body.sizeBytes });
  if (!upload) return undefined;
  const updated = await CandleVideo.findOneAndUpdate(
    { _id: doc._id, status: doc.status, cfVideoUid: doc.cfVideoUid },
    { $set: { cfVideoUid: upload.uid, status: 'uploading', failReason: null, published: false, publishedAt: null, sizeBytes: body.sizeBytes, uploadExpiresAt: upload.expiresAt, checkedAt: null } },
    { new: true },
  ).lean();
  if (!updated) {
    await deleteVideoQuietly(upload.uid);
    return res.status(409).json({ error: 'The video changed in the meantime. Reload the page.' });
  }
  await deleteVideoQuietly(doc.cfVideoUid);
  resetCandleVideosCache();
  await audit(req, 'candle_video.renew', { type: 'candleVideo', id: String(doc._id) }, {});
  return res.json({ video: candleVideoAdminView(updated), uploadUrl: upload.uploadUrl });
}));

router.post('/:id/uploaded', requireRole('editor'), asyncHandler(async (req, res) => {
  const id = idOf(req);
  if (!id) return res.status(404).json({ error: 'Video not found' });
  parseBody(req.body ?? {}, {});
  const doc = await CandleVideo.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Video not found' });
  const fresh = await refreshCandleVideo(doc);
  return res.json({ video: candleVideoAdminView(fresh) });
}));

router.patch('/:id', requireRole('editor'), asyncHandler(async (req, res) => {
  const id = idOf(req);
  if (!id) return res.status(404).json({ error: 'Video not found' });
  const body = parseBody(req.body, { title: opt(titleRule), published: opt(bool()) });
  if (Object.keys(body).length === 0) return res.status(400).json({ error: 'Nothing to change' });
  const doc = await CandleVideo.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Video not found' });
  if (body.published === true && doc.status !== 'ready') return res.status(409).json({ error: 'A video can be published once Cloudflare has finished it' });
  const set = { ...(body.title !== undefined ? { title: body.title } : {}) };
  if (body.published !== undefined && body.published !== doc.published) Object.assign(set, { published: body.published, publishedAt: body.published ? new Date() : null });
  const updated = Object.keys(set).length ? await CandleVideo.findOneAndUpdate({ _id: doc._id }, { $set: set }, { new: true }).lean() : doc;
  resetCandleVideosCache();
  await audit(req, 'candle_video.update', { type: 'candleVideo', id: String(doc._id) }, {
    ...(body.title !== undefined && body.title !== doc.title ? { title: { from: doc.title, to: body.title } } : {}),
    ...(set.published !== undefined ? { published: set.published } : {}),
  });
  return res.json({ video: candleVideoAdminView(updated) });
}));

router.delete('/:id', requireRole('editor'), asyncHandler(async (req, res) => {
  const id = idOf(req);
  if (!id) return res.status(404).json({ error: 'Video not found' });
  const doc = await CandleVideo.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Video not found' });
  const atCloudflare = await deleteVideoQuietly(doc.cfVideoUid);
  await CandleVideo.deleteOne({ _id: doc._id });
  resetCandleVideosCache();
  await audit(req, 'candle_video.delete', { type: 'candleVideo', id: String(doc._id) }, { title: doc.title, deletedAtCloudflare: atCloudflare });
  return res.json({ deleted: true });
}));

export default router;
