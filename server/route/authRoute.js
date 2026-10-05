import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { loginLimiter } from '../utils/security.js';
import { config } from '../config/env.js';

const routerAuth = express.Router();

// Compares digests, so the check takes the same time wherever the passwords differ.
const sameSecret = (given, expected) =>
  timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest());

routerAuth.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (typeof password !== 'string' || !password || !sameSecret(password, config.adminPassword)) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    console.warn(`[${new Date().toISOString()}] Failed auth/login attempt from IP: ${ip}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { role: 'admin' },
    config.jwtSecret,
    { expiresIn: '8h', algorithm: 'HS256' }
  );
  res.json({ token });
});

export default routerAuth;
