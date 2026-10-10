import express from 'express';
import mongoose from 'mongoose';
import Admin from '../../model/admin.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { hashPassword } from '../../services/adminAuth.js';
import { checkPasswordPolicy } from '../../services/passwordPolicy.js';
import { revokeAllSessions } from '../../services/adminSessions.js';
import { ROLES, effectiveRole } from '../../services/roles.js';
import { audit } from '../../services/audit.js';
import { sendMail } from '../../services/emailService.js';
import { isEmail } from '../../utils/validate.js';
import { HttpError } from '../../utils/httpError.js';
import { bool, oneOf, opt, parseBody, secret, str } from '../../utils/schema.js';
import { found, objectId, paginate, parseList } from './common.js';

// User accounts of the dashboard. OWNER ONLY, on every route (mounted behind requireRole('owner') in index.js).
//
//   GET    /admin/users
//   POST   /admin/users              { username, password, role, email? }
//   PATCH  /admin/users/:id          { role?, disabled?, resetTotp?, email? }   (email: '' removes it)
//   DELETE /admin/users/:id
//
// Guards: nobody can delete or disable themselves, change their own role or reset their own second factor, and
// the last enabled owner can never be deleted, disabled or demoted. Disabling, demoting, resetting the second
// factor and deleting all end the account's sessions at once. Setting disabled: false also lifts a lockout.
//
// `email` is the account's RECOVERY address (audit 2026-10-10, F03): "Forgot password" mails its one-time link there
// (services/passwordReset.js). Without one, an account whose username is not an e-mail address cannot recover its
// password. An address belongs to one account only, and is told by mail that it was set.

const router = express.Router();

// Accounts created before roles existed have no `role` field and count as owners; queries must say so.
// (mongoose.trusted keeps $exists: sanitizeFilter, which the server runs with, would otherwise turn it into an equality test.)
const OWNER = { $or: [{ role: 'owner' }, { role: mongoose.trusted({ $exists: false }) }] };
const ENABLED = { disabled: mongoose.trusted({ $ne: true }) };

const roleOf = (admin) => effectiveRole(admin) ?? 'viewer'; // a damaged role is shown as the least access
const isEnabledOwner = (admin) => roleOf(admin) === 'owner' && admin.disabled !== true;

const present = (admin) => ({
  _id: String(admin._id),
  username: admin.username,
  email: admin.email ?? '',
  role: roleOf(admin),
  disabled: admin.disabled === true,
  totpEnabled: admin.totpEnabled === true,
  lockedUntil: admin.lockedUntil ?? null,
  lastLoginAt: admin.lastLoginAt ?? null,
  createdAt: admin.createdAt ?? null,
});

// A recovery address as the API stores it: trimmed, lower-cased; '' means "none".
const recoveryEmail = () => (value, field) => {
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text`);
  const email = value.trim().toLowerCase();
  if (email !== '' && (email.length > 254 || !isEmail(email))) throw new HttpError(400, 'Enter a valid e-mail address');
  return email;
};

// Is this address already the e-mail or the username of another account? (Either would receive its reset link.)
async function emailTaken(email, exceptId) {
  const exact = () => mongoose.trusted({ $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' });
  const match = { $or: [{ email: exact() }, { username: exact() }] };
  const filter = exceptId ? { $and: [{ _id: mongoose.trusted({ $ne: exceptId }) }, match] } : match;
  return Boolean(await Admin.findOne(filter).select('_id').lean());
}

// Tells the address what it is now used for. Plain text, server-made values only; a mail failure is logged by sendMail
// and never fails the request.
const notifyRecoveryEmail = (email, username) =>
  sendMail({
    to: [email],
    subject: 'Nazareth Holy Cross dashboard: recovery address',
    text: [
      `This address is now the recovery address of the dashboard account "${username}".`,
      'If that account ever forgets its password, the reset link is sent here.',
      '',
      'If you did not expect this message, tell the owner of the Nazareth Holy Cross dashboard; you do not need to do anything else.',
    ].join('\n'),
  });

const otherEnabledOwners = (id) =>
  Admin.countDocuments({ $and: [{ _id: mongoose.trusted({ $ne: id }) }, ENABLED, OWNER] });

router.get('/', asyncHandler(async (req, res) => {
  const params = parseList(req.query, {
    searchFields: ['username', 'email'],
    statuses: {
      active: ENABLED,
      owner: OWNER,
      editor: { role: 'editor' },
      viewer: { role: 'viewer' },
      disabled: { disabled: true },
    },
    sorts: { createdAt: true, username: true, lastLoginAt: true },
  });
  const page = await paginate(Admin, params, { select: '-password -totpSecretEnc' });
  res.json({ ...page, items: page.items.map(present) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { username, password, role, email = '' } = parseBody(req.body, {
    username: str({ min: 3, max: 64, pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/ }),
    password: secret({ max: 200 }),
    role: oneOf(ROLES),
    email: opt(recoveryEmail()),
  });
  const problem = checkPasswordPolicy(password, username);
  if (problem) throw new HttpError(400, problem);

  // Names that differ only by case would be confusable on screen: refuse them.
  const pattern = `^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
  if (await Admin.findOne({ username: mongoose.trusted({ $regex: pattern, $options: 'i' }) }).select('_id').lean()) {
    throw new HttpError(409, 'Username already exists');
  }

  if (email && (await emailTaken(email))) throw new HttpError(409, 'This e-mail address is already used by another account');

  const admin = new Admin({ username, password: await hashPassword(password), role, ...(email ? { email } : {}) });
  admin.$locals.passwordHashed = true; // already hashed: the model's save hook must not hash it again
  await admin.save();
  await audit(req, 'user.create', { type: 'user', id: admin._id }, { username, role, hasEmail: Boolean(email) });
  if (email) notifyRecoveryEmail(email, username);
  res.status(201).json({ item: present(admin) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const changes = parseBody(req.body, { role: opt(oneOf(ROLES)), disabled: opt(bool()), resetTotp: opt(bool()), email: opt(recoveryEmail()) });
  if (Object.keys(changes).length === 0) throw new HttpError(400, 'No fields to update');

  const target = found(await Admin.findById(id), 'User');
  const self = id === req.adminUser.id;
  const newRole = changes.role ?? roleOf(target);
  const demoting = newRole !== 'owner' || changes.disabled === true;

  if (self && (changes.disabled === true || newRole !== roleOf(target))) {
    throw new HttpError(400, 'You cannot disable yourself or change your own role');
  }
  if (self && changes.resetTotp === true) throw new HttpError(400, 'Disable your own TOTP from your account settings');
  if (isEnabledOwner(target) && demoting && (await otherEnabledOwners(id)) === 0) {
    throw new HttpError(409, 'The last owner cannot be demoted or disabled');
  }

  const emailChanged = changes.email !== undefined && changes.email !== String(target.email ?? '').trim().toLowerCase();
  if (emailChanged && changes.email && (await emailTaken(changes.email, id))) {
    throw new HttpError(409, 'This e-mail address is already used by another account');
  }

  const set = {};
  // A pending reset link was mailed to the OLD address: it must not outlive the change.
  if (emailChanged) Object.assign(set, { email: changes.email, resetTokenHash: null, resetTokenExpires: null });
  if (changes.role !== undefined) set.role = changes.role;
  if (changes.disabled !== undefined) {
    set.disabled = changes.disabled;
    if (changes.disabled === false) Object.assign(set, { failedLogins: 0, lockedUntil: null }); // re-enabling unlocks
  }
  if (changes.resetTotp === true) Object.assign(set, { totpEnabled: false, totpSecretEnc: null, totpLastStep: -1 });

  const item = found(await Admin.findByIdAndUpdate(id, { $set: set }, { new: true }).select('-password -totpSecretEnc').lean(), 'User');
  if (changes.disabled === true || (changes.role !== undefined && changes.role !== roleOf(target)) || changes.resetTotp === true) {
    await revokeAllSessions(id);
  }
  await audit(req, 'user.update', { type: 'user', id }, { role: changes.role, disabled: changes.disabled, resetTotp: changes.resetTotp, ...(emailChanged ? { email: changes.email ? 'set' : 'removed' } : {}) });
  if (emailChanged && changes.email) notifyRecoveryEmail(changes.email, target.username);
  res.json({ item: present(item) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  if (id === req.adminUser.id) throw new HttpError(400, 'You cannot delete yourself');
  const target = found(await Admin.findById(id), 'User');
  if (isEnabledOwner(target) && (await otherEnabledOwners(id)) === 0) throw new HttpError(409, 'The last owner cannot be deleted');
  await Admin.findByIdAndDelete(id);
  await revokeAllSessions(id);
  await audit(req, 'user.delete', { type: 'user', id }, { username: target.username });
  res.json({ message: 'User deleted' });
}));

export default router;
