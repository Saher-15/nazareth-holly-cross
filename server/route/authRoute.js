import express from 'express';
import { loginLimiter } from '../utils/security.js';
import { checkSharedPassword, signAdminToken } from '../services/adminAuth.js';

const routerAuth = express.Router();

// Sign in with the shared admin password (ADMIN_PASSWORD). The other way in is POST /admin/login (an
// account in the database); both give the same kind of token. See services/adminAuth.js.
routerAuth.post('/login', loginLimiter, (req, res) => {
  res.set('Deprecation', 'true'); // docs/ADMIN.md: replaced by POST /admin/auth/login
  if (!checkSharedPassword(req.body?.password)) {
    const ip = req.ip || 'unknown';
    console.warn(`[${new Date().toISOString()}] Failed auth/login attempt from IP: ${ip}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: signAdminToken({ auth: 'shared-password' }) });
});

export default routerAuth;
