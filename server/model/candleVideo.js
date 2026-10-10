import mongoose from 'mongoose';
import { RECORDING_STATUSES, TITLE_MAX } from '../services/liveConstants.js';

const { Schema } = mongoose;

// A video shown on the website's candle page (docs/ADMIN.md 5.5): uploaded by an editor straight to Cloudflare Stream
// (Direct Creator Upload, the same pipeline as the broadcast recordings, docs/LIVE.md), shown once it is ready and
// published. Not tied to a broadcast. Services: services/candleVideos.js.
const candleVideoSchema = new Schema({
  title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 1, maxlength: [TITLE_MAX, 'Title too long'] },
  cfVideoUid: { type: String, required: true, trim: true, maxlength: [64, 'Video id too long'] },
  customerCode: { type: String, trim: true, maxlength: [64, 'Code too long'], default: '' },
  status: { type: String, enum: RECORDING_STATUSES, default: 'uploading' },
  failReason: { type: String, trim: true, maxlength: [120, 'Reason too long'], default: null },
  sizeBytes: { type: Number, min: 0, default: 0 },
  durationSeconds: { type: Number, min: 0, max: 86_400, default: 0 },
  published: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
  uploadExpiresAt: { type: Date, default: null },
  checkedAt: { type: Date, default: null },
  createdBy: {
    id: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, trim: true, maxlength: [100, 'Name too long'], default: '' },
  },
}, { timestamps: true });

candleVideoSchema.index({ published: 1, status: 1, createdAt: -1 });

export default mongoose.model('CandleVideo', candleVideoSchema, 'candleVideo');
