import crypto from 'node:crypto';
import { config } from '../config/env.js';

// Purpose-bound keys derived from JWT_SECRET with HKDF-SHA256, so no secret is used for two jobs and no new
// environment variable is needed: `info` names the job ('totp-secret-encryption-v1', 'audit-ip-hash-v1').
// Rotating JWT_SECRET changes every derived key (stored TOTP secrets must then be set up again).
const HKDF_SALT = 'nhc-admin';

export const derivedKey = (info) => Buffer.from(crypto.hkdfSync('sha256', config.jwtSecret, HKDF_SALT, info, 32));
