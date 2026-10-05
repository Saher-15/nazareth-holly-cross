import Admin from '../model/admin.js';
import { isSessionLive, verifyAnyToken } from '../services/adminSessions.js';
import { atLeast, effectiveRole, isRole } from '../services/roles.js';
import { adminLimiter } from '../utils/security.js';

// Guards the admin dashboard API (route/admin/*).
//
//   adminAuth       proves who is calling: a Bearer token whose session is live and whose account still exists and
//                   is enabled. Sets req.adminUser = { id, username, role, sid } with the role read from the
//                   database NOW (a demoted or disabled user is refused on the next request), and req.adminDoc.
//   requireRole(r)  lets through an account whose role is at least r (owner > editor > viewer); else 403.
//
// Legacy tokens (shared password / old accounts) belong to the old admin site. Where a legacy route with the same
// address exists (LEGACY_PREFIXES) the request is passed on to it (next('router')), so the old site keeps working
// until it is retired; anywhere else a legacy token is simply not accepted (401).

const LEGACY_PREFIXES = /^\/(stats|prayers|candles|products|product-reviews)(\/|$)/;

const unauthorized = (res, message = 'Unauthorized') => res.status(401).json({ error: message });

export async function adminAuth(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return unauthorized(res);

  let verified;
  try {
    verified = verifyAnyToken(header.slice(7));
  } catch {
    return unauthorized(res, 'Invalid or expired token');
  }

  if (verified.kind === 'legacy') {
    // req.path is relative to where the guard is mounted; the legacy routes are matched by the full /admin/... path.
    const fullPath = `${req.baseUrl}${req.path}`.replace(/^\/admin/, '');
    return LEGACY_PREFIXES.test(fullPath) ? next('router') : unauthorized(res, 'Invalid or expired token');
  }

  try {
    const { sub, sid } = verified.payload;
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
