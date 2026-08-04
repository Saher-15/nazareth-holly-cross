import express from 'express';
import jwt from 'jsonwebtoken';
import { loginLimiter } from '../utils/security.js';

const routerAuth = express.Router();

routerAuth.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    console.warn(`[${new Date().toISOString()}] Failed auth/login attempt from IP: ${ip}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h', algorithm: 'HS256' }
  );
  res.json({ token });
});

export default routerAuth;
