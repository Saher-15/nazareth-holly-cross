import mongoose from 'mongoose';
import { DESCRIPTION_MAX, SCHEDULE_STATUSES, TITLE_MAX } from '../services/liveConstants.js';
const { Schema } = mongoose;

// A broadcast announced ahead of time (docs/LIVE.md, route/admin/liveSchedule.js). The website's /live page shows the
// published ones that are still to come, the next one with a countdown.
//
//   scheduled   announced (shown on the website only when `published`)
//   live        an admin started the live broadcast from this item (`liveSession` points at it)
//   done        that broadcast ended
//   cancelled   called off; kept for the record, never shown on the website
//
// `startsAt` is stored in UTC; the dashboard types and shows it in Nazareth time (services/liveSchedule.js).

const actor = {
  id: { type: Schema.Types.ObjectId, default: null },
  name: { type: String, trim: true, maxlength: [100, 'Name too long'], default: '' },
};

const scheduledBroadcastSchema = new Schema({
  title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 1, maxlength: [TITLE_MAX, 'Title too long'] },
  description: { type: String, trim: true, maxlength: [DESCRIPTION_MAX, 'Description too long'], default: '' },
  startsAt: { type: Date, required: true },
  published: { type: Boolean, default: false },
  status: { type: String, enum: SCHEDULE_STATUSES, default: 'scheduled' },
  liveSession: { type: Schema.Types.ObjectId, ref: 'LiveSession', default: null },
  createdBy: actor,
  updatedBy: actor,
}, { timestamps: true });

// The dashboard's list and the website's upcoming broadcasts, in the order they start.
scheduledBroadcastSchema.index({ startsAt: 1 });
scheduledBroadcastSchema.index({ published: 1, status: 1, startsAt: 1 });
// The end of a live broadcast marks the scheduled item it came from as done.
scheduledBroadcastSchema.index({ liveSession: 1 });

export default mongoose.model('ScheduledBroadcast', scheduledBroadcastSchema, 'scheduledBroadcast');
