import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import AdminSession from '../model/adminSession.js';
import { config } from '../config/env.js';
import { isRole } from './roles.js';

// Sessions and tokens of the admin dashboard.
//
// Token:   JWT HS256 signed with JWT_SECRET, 60 minutes, payload { sub: admin id, role, sid } (+ iat, exp).
// Session: a document in the AdminSession collection with the same `sid`. A token is only good while its session
//          is live (not revoked, not expired), so signing out, changing the password or disabling an account
//          takes effect on the very next request. The role inside the token is informational: the guard
//          (middleware/adminGuard.js) always reads the current role from the account.
//
// Only session tokens exist. The older shared-password / account tokens (role "admin", 8 hours, no sid) were issued
// by the legacy sign-ins removed on 2026-10-07; one that is still within its 8 hours is refused like any other
// token that is not a session token (verifySessionToken throws), so none of them works anywhere any more.

export const SESSION_SECONDS = 60 * 60;
const ALGORITHM = 'HS256';
const CLOCK_TOLERANCE_SECONDS = 5;

export async function createSession(adminId) {
  const sid = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  await AdminSession.create({ sid, admin: adminId, expiresAt });
  return { sid, expiresAt };
}

export function signSessionToken({ id, role }, sid) {
  return jwt.sign({ sub: String(id), role, sid }, config.jwtSecret, { algorithm: ALGORITHM, expiresIn: SESSION_SECONDS });
}

// Verifies signature (HS256 only), expiry and age, and that the token is a dashboard session token
// ({ sub, sid, role } with a lifetime of at most SESSION_SECONDS). Returns the payload; throws for anything else,
// including the legacy 8-hour tokens ({ role: 'admin' } or { id, username }, no sid).
export function verifySessionToken(token) {
  const payload = jwt.verify(token, config.jwtSecret, {
    algorithms: [ALGORITHM], // never trust the token's own "alg"
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
    maxAge: SESSION_SECONDS + CLOCK_TOLERANCE_SECONDS, // also rejects a token without an issue time
  });
  if (typeof payload.sid !== 'string' || typeof payload.sub !== 'string' || !isRole(payload.role)) {
    throw new jwt.JsonWebTokenError('not a session token');
  }
  if (!payload.exp || payload.exp - payload.iat > SESSION_SECONDS + CLOCK_TOLERANCE_SECONDS) {
    throw new jwt.JsonWebTokenError('session token lives too long');
  }
  return payload;
}

// True while the session exists, belongs to this account, is not revoked and has not expired.
export async function isSessionLive(sid, adminId) {
  const session = await AdminSession.findOne({ sid }).lean();
  return Boolean(
    session
    && !session.revokedAt
    && new Date(session.expiresAt).getTime() > Date.now()
    && String(session.admin) === String(adminId),
  );
}

export const revokeSession = (sid) => AdminSession.updateOne({ sid, revokedAt: null }, { $set: { revokedAt: new Date() } });

// Every live session of the account except `exceptSid` (the one making the request).
export const revokeOtherSessions = (adminId, exceptSid) =>
  AdminSession.updateMany(
    { admin: adminId, sid: mongoose.trusted({ $ne: exceptSid }), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

export const revokeAllSessions = (adminId) =>
  AdminSession.updateMany({ admin: adminId, revokedAt: null }, { $set: { revokedAt: new Date() } });
