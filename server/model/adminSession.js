import mongoose from 'mongoose';
const { Schema } = mongoose;

// One document per sign-in. The token carries the session id (`sid`); a request is accepted only while its session
// exists, is not revoked and has not expired. Revoking a session (sign-out, password change, user disabled) is
// therefore immediate, which a stateless token alone cannot do. Revoked sessions stay (flagged) until they expire,
// which is the revocation list; the TTL index then removes them.
const adminSessionSchema = new Schema({
  sid: { type: String, required: true, unique: true, maxlength: 64 },
  admin: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
}, { versionKey: false });

adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AdminSession', adminSessionSchema, 'adminSession');
