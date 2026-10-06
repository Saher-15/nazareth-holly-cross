import mongoose from 'mongoose';
const { Schema } = mongoose;

// One document per live broadcast started from the dashboard (docs/LIVE.md, route/admin/live.js).
//
//   live    the broadcast is on: the public /live page shows the player
//   ended   stopped by the admin, ended by an owner, or ended automatically after LIVE_MAX_MS
//
// What is NOT stored, on purpose: the WHIP publish address. It contains Cloudflare's secret for this input (anyone who
// has it can broadcast on our page), so the API hands it once to the admin who started the session and forgets it.
// `whepUrl` is the PUBLIC playback address (it is meant to be given to every viewer).

export const LIVE_STATUSES = ['live', 'ended'];
export const LIVE_END_REASONS = ['stopped', 'forced', 'auto', 'failed'];

const actor = {
  id: { type: Schema.Types.ObjectId, default: null },
  name: { type: String, trim: true, maxlength: [100, 'Name too long'], default: '' },
};

const liveSessionSchema = new Schema({
  title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 1, maxlength: [120, 'Title too long'] },
  status: { type: String, enum: LIVE_STATUSES, default: 'live' },
  inputUid: { type: String, required: true, trim: true, maxlength: [64, 'Input id too long'] },
  whepUrl: { type: String, required: true, trim: true, maxlength: [512, 'Address too long'] },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  endReason: { type: String, enum: LIVE_END_REASONS, default: null }, // null while live (enum validators let null pass)
  startedBy: actor,
  endedBy: actor,
  // The Cloudflare live input was deleted when the session ended (false: it could not be, see the log).
  inputDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// At most ONE live session, enforced by the database (two simultaneous "start" requests: the second fails with a
// duplicate key and the route answers 409). It also serves "the session that is live now" and the auto-end query.
liveSessionSchema.index({ status: 1 }, { unique: true, partialFilterExpression: { status: 'live' } });
// The dashboard's recent broadcasts, newest first.
liveSessionSchema.index({ startedAt: -1 });

export default mongoose.model('LiveSession', liveSessionSchema, 'liveSession');
