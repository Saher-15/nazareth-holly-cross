import Admin from '../model/admin.js';
import { isSessionLive, verifySessionToken } from '../services/adminSessions.js';
import { atLeast, effectiveRole, isRole } from '../services/roles.js';
import { adminLimiter } from '../utils/security.js';

// Guards the admin dashboard API (route/admin/*). It is the ONLY way into private data: the legacy requireAdmin
// middleware, its 8-hour tokens and every route that used it were removed on 2026-10-07 (docs/SECURITY.md 4.1).
//
//   adminAuth       proves who is calling: a Bearer session token whose session is live and whose account still
//                   exists and is enabled. Sets req.adminUser = { id, username, role, sid } with the role read from the
//                   database NOW (a demoted or disabled user is refused on the next request), and req.adminDoc.
//   requireRole(r)  lets through an account whose role is at least r (owner > editor > viewer); else 403.
//
// A legacy token (shared password / old account sign-in, no session id) is refused with 401 like any other token
// that is not a live session's.

const unauthorized = (res, message = 'Unauthorized') => res.status(401).json({ error: message });

export async function adminAuth(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return unauthorized(res);

  let payload;
  try {
    payload = verifySessionToken(header.slice(7));
  } catch {
    return unauthorized(res, 'Invalid or expired token');
  }

  try {
    const { sub, sid } = payload;
    if (!(await isSessionLive(sid, sub))) return unauthorized(res, 'Session ended');
    const admin = await Admin.findById(sub);
    if (!admin || admin.disabled === true) return unauthorized(res, 'Session ended');
    const role = effectiveRole(admin); // accounts that predate roles are owners; a damaged role gives no access
    if (!role) return unauthorized(res, 'Session ended');
    req.adminUser = { id: String(admin._id), username: admin.username, role, sid };
    req.adminDoc = admin; // the full account, for the routes that need it (password, second factor)
    return next();
  } catch (err) {
    return next(err);
  }
}

// Authentication followed by the per-admin rate limit; use this on every protected route.
export const adminAccess = [adminAuth, adminLimiter];

export const requireRole = (minimum) => {
  if (!isRole(minimum)) throw new Error(`Unknown role: ${minimum}`);
  return (req, res, next) => {
    if (!req.adminUser) return unauthorized(res);
    if (!atLeast(req.adminUser.role, minimum)) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };
};
