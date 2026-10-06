import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../services/roles.js';

// An admin account. Documents created before roles existed have none of the new fields: they read as an enabled
// owner with no lockout and no second factor (the defaults below apply when a stored document lacks the field).
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  password: { type: String, required: true, maxlength: 200 }, // a bcrypt hash (60 characters) once saved; a typed password is at most 200
  email: { type: String, trim: true, maxlength: 254 },
  role: { type: String, enum: ROLES, default: 'owner' },
  disabled: { type: Boolean, default: false },
  // 5 failures in a row lock the account for 15 minutes (routes/admin/auth.js); a success resets both.
  failedLogins: { type: Number, default: 0, min: 0 },
  lockedUntil: { type: Date, default: null },
  // Second factor (services/totp.js). The secret is AES-256-GCM encrypted; it is never returned by the API.
  totpSecretEnc: { type: String, default: null, select: false, maxlength: 500 },
  totpEnabled: { type: Boolean, default: false },
  totpLastStep: { type: Number, default: -1 }, // the last accepted 30-second step: a code cannot be used twice
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

// Hashes a plain password on save. Code that already hashed it (the admin API, the create-admin script) sets
// doc.$locals.passwordHashed = true so it is not hashed a second time.
adminSchema.pre('save', async function () {
  if (!this.isModified('password') || this.$locals?.passwordHashed) return;
  this.password = await bcrypt.hash(this.password, 12);
});

adminSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model('Admin', adminSchema);
