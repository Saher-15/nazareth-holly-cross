import { verifyAdminToken } from '../services/adminAuth.js';

// Guards every admin route. Responses to authenticated requests carry private data, so they are never cached.
export const requireAdmin = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.admin = verifyAdminToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
