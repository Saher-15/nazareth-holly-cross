import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

// Admin authentication. There are two ways to sign in, kept side by side (the admin site uses both):
//
//   POST /auth/login   { password }              the shared ADMIN_PASSWORD from the environment
//   POST /admin/login  { username, password }    an Admin account in the database (bcrypt hash)
//
// Both end in the same kind of token: HS256, signed with JWT_SECRET, valid for 8 hours, carrying
// role: 'admin' and how it was obtained (auth: 'shared-password' | 'account'). requireAdmin accepts
// either; nothing else grants access. See docs/SECURITY.md.

export const TOKEN_LIFETIME = '8h';
const ALGORITHM = 'HS256';
const CLOCK_TOLERANCE_SECONDS = 5;

// Compares two strings without leaking where they differ: both are hashed to the same length first, so
// the comparison time depends on neither the content nor the length of what was typed.
export function safeEqual(a, b) {
  const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}

export function checkSharedPassword(password) {
  return typeof password === 'string' && password.length > 0 && safeEqual(password, config.adminPassword);
}

export function signAdminToken(claims) {
  return jwt.sign({ role: 'admin', ...claims }, config.jwtSecret, { expiresIn: TOKEN_LIFETIME, algorithm: ALGORITHM });
}

export function verifyAdminToken(token) {
  const payload = jwt.verify(token, config.jwtSecret, {
    algorithms: [ALGORITHM], // never trust the token's own "alg" (blocks "none" and key-confusion tricks)
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
    maxAge: TOKEN_LIFETIME, // also rejects a token without an issue time, whatever its exp says
  });
  // Tokens issued before `role` existed: shared-password tokens had it already, account tokens had id + username.
  const legacyAccount = payload.id && payload.username;
  if (payload.role !== 'admin' && !legacyAccount) throw new jwt.JsonWebTokenError('not an admin token');
  return payload;
}

// A password check that takes as long for an unknown username as for a wrong password,
// so response time does not reveal which usernames exist.
let dummyHash;
export async function comparePasswordTimingSafe(admin, password) {
  dummyHash ??= bcrypt.hashSync('not-a-real-password', 10);
  const text = typeof password === 'string' ? password : '';
  if (!admin) {
    await bcrypt.compare(text, dummyHash);
    return false;
  }
  return admin.comparePassword(text);
}

// Text from a request, safe to put in a log line (no line breaks, no control characters, bounded).
export const forLog = (value) => JSON.stringify(String(value ?? '')).slice(0, 80);
