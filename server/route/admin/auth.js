import express from 'express';
import Admin from '../../model/admin.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { adminAccess } from '../../middleware/adminGuard.js';
import { adminLoginIpLimiter, adminLoginLimiter, adminSensitiveLimiter } from '../../utils/security.js';
import { comparePasswordTimingSafe, hashPassword } from '../../services/adminAuth.js';
import { createSession, revokeOtherSessions, revokeSession, signSessionToken, SESSION_SECONDS } from '../../services/adminSessions.js';
import { checkPasswordPolicy } from '../../services/passwordPolicy.js';
import { decryptSecret, encryptSecret, isCodeFormat, newSecret, otpauthUrl, verifyTotp } from '../../services/totp.js';
import { audit } from '../../services/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { parseBody, secret, str } from '../../utils/schema.js';
import { effectiveRole } from '../../services/roles.js';

const router = express.Router();

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

const publicUser = (admin) => ({
  id: String(admin._id),
  username: admin.username,
  role: effectiveRole(admin),
  totpEnabled: admin.totpEnabled === true,
});

// ---------------------------------------------------------------------------------------------------------------
// POST /admin/auth/login { username, password, totp? }
//
// Every way of failing - unknown user, wrong password, locked or disabled account, wrong second factor, a body of
// the wrong shape - answers the same 401 { error: 'Invalid credentials' } after the same bcrypt work, so neither the
// answer nor its timing says which one it was. (The reason goes to the audit log.) The one exception is the
// documented 428 { error: 'totp_required' }, which is only ever sent after the password was correct.
// ---------------------------------------------------------------------------------------------------------------

const INVALID = { error: 'Invalid credentials' };

async function registerFailure(req, admin, reason) {
  req.auditActor = { username: req.loginName };
  const meta = { reason };
  let locked = false;
  if (admin && (reason === 'wrong_password' || reason === 'wrong_totp')) {
    // One atomic increment, so parallel guesses cannot all see the same count.
    const updated = await Admin.findOneAndUpdate({ _id: admin._id }, { $inc: { failedLogins: 1 } }, { new: true, projection: { failedLogins: 1 } });
    if (updated && updated.failedLogins >= MAX_FAILED_LOGINS) {
      await Admin.updateOne({ _id: admin._id }, { $set: { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000), failedLogins: 0 } });
      locked = true;
    }
  }
  await audit(req, 'auth.login_failed', admin ? { type: 'admin', id: String(admin._id) } : null, meta);
  if (locked) await audit(req, 'auth.account_locked', { type: 'admin', id: String(admin._id) }, { minutes: LOCK_MINUTES });
}

router.post('/login', adminLoginLimiter, adminLoginIpLimiter, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const body = req.body !== null && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { username, password, totp } = body;
  const wellFormed = typeof username === 'string' && username.trim().length > 0 && username.length <= 100
    && typeof password === 'string' && password.length > 0 && password.length <= 200
    && (totp === undefined || typeof totp === 'string');
  req.loginName = typeof username === 'string' ? username.trim().slice(0, 100) : '';

  // The username must be plain text before it reaches the query ({ "$ne": null } never does).
  const admin = wellFormed ? await Admin.findOne({ username: username.trim() }).select('+totpSecretEnc') : null;
  const locked = Boolean(admin?.lockedUntil) && new Date(admin.lockedUntil).getTime() > Date.now();
  const disabled = admin?.disabled === true;
  const usable = admin && !locked && !disabled && effectiveRole(admin) !== null;

  // Same bcrypt work whatever happened (an unusable account is checked against a dummy hash).
  const passwordOk = await comparePasswordTimingSafe(usable ? admin : null, wellFormed ? password : '');

  if (!wellFormed || !usable || !passwordOk) {
    const reason = !wellFormed ? 'malformed' : !admin ? 'unknown_user' : locked ? 'locked' : disabled ? 'disabled' : !usable ? 'invalid_role' : 'wrong_password';
    await registerFailure(req, admin, reason);
    return res.status(401).json(INVALID);
  }

  let usedStep = null;
  if (admin.totpEnabled === true) {
    if (!isCodeFormat(totp)) return res.status(428).json({ error: 'totp_required' });
    const secretBase32 = decryptSecret(admin.totpSecretEnc);
    usedStep = secretBase32 ? verifyTotp(secretBase32, totp, { afterStep: Number.isInteger(admin.totpLastStep) ? admin.totpLastStep : -1 }) : null;
    if (usedStep === null) {
      await registerFailure(req, admin, secretBase32 ? 'wrong_totp' : 'totp_secret_unreadable');
      return res.status(401).json(INVALID);
    }
  }

  const now = new Date();
  await Admin.updateOne({ _id: admin._id }, {
    $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: now, ...(usedStep !== null ? { totpLastStep: usedStep } : {}) },
  });
  const user = publicUser(admin);
  const { sid } = await createSession(admin._id);
  const token = signSessionToken(user, sid);
  req.adminUser = { id: user.id, username: user.username, role: user.role, sid };
  await audit(req, 'auth.login', { type: 'admin', id: user.id }, { totp: user.totpEnabled });
  res.json({ token, expiresIn: SESSION_SECONDS, user });
}));

// POST /admin/auth/logout: the session is revoked, so this token stops working at once.
router.post('/logout', ...adminAccess, asyncHandler(async (req, res) => {
  await revokeSession(req.adminUser.sid);
  await audit(req, 'auth.logout', { type: 'admin', id: req.adminUser.id });
  res.status(204).end();
}));

// GET /admin/auth/me
router.get('/me', ...adminAccess, (req, res) => {
  const admin = req.adminDoc;
  res.json({ ...publicUser(admin), lastLoginAt: admin.lastLoginAt ?? null });
});

// POST /admin/auth/password { currentPassword, newPassword }
router.post('/password', ...adminAccess, adminSensitiveLimiter, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = parseBody(req.body, { currentPassword: secret(), newPassword: secret({ max: 200 }) });
  const admin = req.adminDoc;
  if (!(await comparePasswordTimingSafe(admin, currentPassword))) {
    await audit(req, 'auth.password_change_failed', { type: 'admin', id: req.adminUser.id }, { reason: 'wrong_current_password' });
    throw new HttpError(403, 'Current password is incorrect');
  }
  const problem = checkPasswordPolicy(newPassword, admin.username);
  if (problem) throw new HttpError(400, problem);
  if (await comparePasswordTimingSafe(admin, newPassword)) throw new HttpError(400, 'The new password must differ from the current one');

  await Admin.updateOne({ _id: admin._id }, { $set: { password: await hashPassword(newPassword), failedLogins: 0, lockedUntil: null } });
  await revokeOtherSessions(admin._id, req.adminUser.sid);
  await audit(req, 'auth.password_change', { type: 'admin', id: req.adminUser.id });
  res.status(204).end();
}));

// ---- Two-factor authentication (TOTP) ----
// setup -> shows the secret / otpauth URL once; enable -> proves the authenticator app has it; disable needs the
// password and a current code. Enabling or disabling signs out the account's other sessions.

const withSecret = (id) => Admin.findById(id).select('+totpSecretEnc');

router.post('/totp/setup', ...adminAccess, asyncHandler(async (req, res) => {
  const admin = req.adminDoc;
  if (admin.totpEnabled === true) throw new HttpError(409, 'TOTP is already enabled; disable it first');
  const secretBase32 = newSecret();
  await Admin.updateOne({ _id: admin._id }, { $set: { totpSecretEnc: encryptSecret(secretBase32), totpEnabled: false } });
  await audit(req, 'auth.totp_setup', { type: 'admin', id: req.adminUser.id });
  res.json({ secret: secretBase32, otpauthUrl: otpauthUrl(admin.username, secretBase32) });
}));

router.post('/totp/enable', ...adminAccess, adminSensitiveLimiter, asyncHandler(async (req, res) => {
  const { code } = parseBody(req.body, { code: str({ min: 6, max: 6, pattern: /^\d{6}$/ }) });
  const admin = await withSecret(req.adminUser.id);
  if (admin.totpEnabled === true) throw new HttpError(409, 'TOTP is already enabled');
  const secretBase32 = decryptSecret(admin.totpSecretEnc);
  if (!secretBase32) throw new HttpError(409, 'Start with POST /admin/auth/totp/setup');
  const step = verifyTotp(secretBase32, code);
  if (step === null) {
    await audit(req, 'auth.totp_enable_failed', { type: 'admin', id: req.adminUser.id });
    throw new HttpError(400, 'Invalid code');
  }
  await Admin.updateOne({ _id: admin._id }, { $set: { totpEnabled: true, totpLastStep: step } });
  await revokeOtherSessions(admin._id, req.adminUser.sid);
  await audit(req, 'auth.totp_enable', { type: 'admin', id: req.adminUser.id });
  res.status(204).end();
}));

router.post('/totp/disable', ...adminAccess, adminSensitiveLimiter, asyncHandler(async (req, res) => {
  const { password, code } = parseBody(req.body, { password: secret(), code: str({ min: 6, max: 6, pattern: /^\d{6}$/ }) });
  const admin = await withSecret(req.adminUser.id);
  if (!(await comparePasswordTimingSafe(admin, password))) {
    await audit(req, 'auth.totp_disable_failed', { type: 'admin', id: req.adminUser.id }, { reason: 'wrong_password' });
    throw new HttpError(403, 'Current password is incorrect');
  }
  if (admin.totpEnabled !== true) throw new HttpError(409, 'TOTP is not enabled');
  const secretBase32 = decryptSecret(admin.totpSecretEnc);
  const step = secretBase32 ? verifyTotp(secretBase32, code, { afterStep: Number.isInteger(admin.totpLastStep) ? admin.totpLastStep : -1 }) : null;
  if (step === null) {
    await audit(req, 'auth.totp_disable_failed', { type: 'admin', id: req.adminUser.id }, { reason: 'wrong_code' });
    throw new HttpError(403, 'Invalid code');
  }
  await Admin.updateOne({ _id: admin._id }, { $set: { totpEnabled: false, totpSecretEnc: null, totpLastStep: -1 } });
  await revokeOtherSessions(admin._id, req.adminUser.sid);
  await audit(req, 'auth.totp_disable', { type: 'admin', id: req.adminUser.id });
  res.status(204).end();
}));

export default router;
