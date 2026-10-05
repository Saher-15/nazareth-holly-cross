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
import { HttpError } from '../../utils/httpError.js';
import { bool, oneOf, opt, parseBody, secret, str } from '../../utils/schema.js';
import { found, objectId, paginate, parseList } from './common.js';

// User accounts of the dashboard. OWNER ONLY, on every route (mounted behind requireRole('owner') in index.js).
//
//   GET    /admin/users
//   POST   /admin/users              { username, password, role }
//   PATCH  /admin/users/:id          { role?, disabled?, resetTotp? }
//   DELETE /admin/users/:id
//
// Guards: nobody can delete or disable themselves, change their own role or reset their own second factor, and
// the last enabled owner can never be deleted, disabled or demoted. Disabling, demoting, resetting the second
// factor and deleting all end the account's sessions at once. Setting disabled: false also lifts a lockout.

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

const otherEnabledOwners = (id) =>
  Admin.countDocuments({ $and: [{ _id: mongoose.trusted({ $ne: id }) }, ENABLED, OWNER] });

router.get('/', asyncHandler(async (req, res) => {
  const params = parseList(req.query, {
    searchFields: ['username', 'email'],
    statuses: {
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
  const { username, password, role } = parseBody(req.body, {
    username: str({ min: 3, max: 64, pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/ }),
    password: secret({ max: 200 }),
    role: oneOf(ROLES),
  });
  const problem = checkPasswordPolicy(password, username);
  if (problem) throw new HttpError(400, problem);

  // Names that differ only by case would be confusable on screen: refuse them.
  const pattern = `^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
  if (await Admin.findOne({ username: mongoose.trusted({ $regex: pattern, $options: 'i' }) }).select('_id').lean()) {
    throw new HttpError(409, 'Username already exists');
  }

  const admin = new Admin({ username, password: await hashPassword(password), role });
  admin.$locals.passwordHashed = true; // already hashed: the model's save hook must not hash it again
  await admin.save();
  await audit(req, 'user.create', { type: 'user', id: admin._id }, { username, role });
  res.status(201).json({ item: present(admin) });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const changes = parseBody(req.body, { role: opt(oneOf(ROLES)), disabled: opt(bool()), resetTotp: opt(bool()) });
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

  const set = {};
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
  await audit(req, 'user.update', { type: 'user', id }, { role: changes.role, disabled: changes.disabled, resetTotp: changes.resetTotp });
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
