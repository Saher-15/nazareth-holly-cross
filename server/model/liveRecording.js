import mongoose from 'mongoose';
import { RECORDING_STATUSES, TITLE_MAX } from '../services/liveConstants.js';
const { Schema } = mongoose;

// One recording per live broadcast (docs/LIVE.md, route/admin/liveRecordings.js).
//
// Cloudflare does not record WebRTC inputs, so the admin's browser records the broadcast itself (MediaRecorder) and,
// after "End broadcast", uploads the file STRAIGHT to Cloudflare Stream with a one-time upload address our API asked
// Cloudflare for (Direct Creator Upload, tus). The API never sees the video bytes.
//
//   uploading   the upload address was given out; the browser is sending the file
//   processing  the browser said the upload finished (or Cloudflare already has the file); Cloudflare is encoding it
//   ready       Cloudflare can play it: it may be published on the website's /live page
//   failed      Cloudflare could not encode it, or the video disappeared from Cloudflare
//
// What is NOT stored, on purpose: the one-time upload address (anyone holding it can upload a video into the account
// until it is used or expires). The API hands it once to the admin who asked and forgets it, like the WHIP address.

const actor = {
  id: { type: Schema.Types.ObjectId, default: null },
  name: { type: String, trim: true, maxlength: [100, 'Name too long'], default: '' },
};

const liveRecordingSchema = new Schema({
  session: { type: Schema.Types.ObjectId, ref: 'LiveSession', required: true },
  title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 1, maxlength: [TITLE_MAX, 'Title too long'] },
  // When the broadcast was live (copied from the session: the public list shows the date of the live, not of the upload).
  liveStartedAt: { type: Date, required: true },
  liveEndedAt: { type: Date, default: null },
  // What the browser measured, replaced by Cloudflare's own figure once the video is ready.
  durationSeconds: { type: Number, min: 0, max: 86_400, default: 0 },
  sizeBytes: { type: Number, min: 0, default: 0 },
  mimeType: { type: String, trim: true, maxlength: [100, 'Type too long'], default: '' },
  // The Cloudflare Stream video (32 hex) and the customer code of the account's Stream host
  // (https://customer-<code>.cloudflarestream.com): the player and the thumbnail are derived from both.
  cfVideoUid: { type: String, required: true, trim: true, maxlength: [64, 'Video id too long'] },
  customerCode: { type: String, trim: true, maxlength: [64, 'Code too long'], default: '' },
  status: { type: String, enum: RECORDING_STATUSES, default: 'uploading' },
  failReason: { type: String, trim: true, maxlength: [120, 'Reason too long'], default: null },
  published: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
  // Until when Cloudflare accepts the upload at the address it gave (a new address can be asked for after that).
  uploadExpiresAt: { type: Date, default: null },
  // The last time the API asked Cloudflare about the video (the dashboard's list asks at most every few seconds).
  checkedAt: { type: Date, default: null },
  createdBy: actor,
}, { timestamps: true });

// One recording per broadcast (two uploads of the same broadcast at the same moment: the second gets 409).
liveRecordingSchema.index({ session: 1 }, { unique: true });
// The dashboard's list, newest broadcast first.
liveRecordingSchema.index({ liveStartedAt: -1 });
// The website's "past broadcasts": published and ready, newest first.
liveRecordingSchema.index({ published: 1, status: 1, liveStartedAt: -1 });

export default mongoose.model('LiveRecording', liveRecordingSchema, 'liveRecording');
