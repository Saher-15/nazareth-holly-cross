import mongoose from 'mongoose';
const { Schema } = mongoose;

export const AUDIT_RETENTION_DAYS = 180;

// Who did what, when. Written only by services/audit.js; never edited, only expired by the TTL index.
const auditLogSchema = new Schema({
  at: { type: Date, default: Date.now },
  actorId: { type: Schema.Types.ObjectId, default: null }, // null for a failed sign-in (no account was proven)
  actorName: { type: String, default: '', maxlength: 100 }, // for a failed sign-in: the name that was typed
  role: { type: String, default: '' },
  action: { type: String, required: true, maxlength: 60 }, // 'auth.login', 'order.update', 'export.orders', ...
  target: {
    type: { type: String, default: '', maxlength: 40 },
    id: { type: String, default: '', maxlength: 64 },
  },
  meta: { type: Schema.Types.Mixed, default: {} }, // small, secret-free details (services/audit.js cleans them)
  ipHash: { type: String, default: '', maxlength: 64 }, // keyed hash of the address: comparable, not reversible
  ua: { type: String, default: '', maxlength: 80 }, // "Chrome 126 / Windows"
}, { versionKey: false });

auditLogSchema.index({ at: -1 });
auditLogSchema.index({ actorName: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });
auditLogSchema.index({ at: 1 }, { expireAfterSeconds: AUDIT_RETENTION_DAYS * 24 * 60 * 60 }); // kept 180 days

export default mongoose.model('AuditLog', auditLogSchema, 'auditLog');
