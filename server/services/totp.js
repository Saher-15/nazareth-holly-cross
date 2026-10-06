import crypto from 'node:crypto';
import { derivedKey } from './keys.js';

// Time-based one-time passwords (RFC 6238 on top of RFC 4226 HOTP): HMAC-SHA1, 6 digits, 30-second steps, the
// parameters every authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password) expects.
// Only node:crypto is used. See docs/ADMIN.md for how it is used in the sign-in flow.

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD = 30;
export const TOTP_WINDOW = 1; // accept the previous and the next step too (clock drift of up to 30 s)
export const TOTP_ISSUER = 'Nazareth Holy Cross';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const index = B32.indexOf(char);
    if (index === -1) throw new Error('Invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// RFC 4226: HMAC-SHA1 over the 8-byte big-endian counter, dynamic truncation, modulo 10^digits.
export function hotp(key, counter, digits = TOTP_DIGITS) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export const stepAt = (timeMs, period = TOTP_PERIOD) => Math.floor(timeMs / 1000 / period);

// The code for a base32 secret at a moment in time (RFC 6238).
export function totp(secretBase32, timeMs = Date.now(), { digits = TOTP_DIGITS, period = TOTP_PERIOD } = {}) {
  return hotp(base32Decode(secretBase32), stepAt(timeMs, period), digits);
}

export const isCodeFormat = (code) => typeof code === 'string' && /^\d{6}$/.test(code);

// Checks a code against the steps around now. Returns the matching step number, or null. Every step in the window
// is compared (in constant time) whether or not an earlier one matched, so the answer's timing says nothing about
// which step was right. `afterStep` is the last step that was already used: a code for that step or an earlier one
// is refused, so a code that was just accepted (or shoulder-surfed) cannot be replayed within its 30 seconds.
export function verifyTotp(secretBase32, code, { now = Date.now(), window = TOTP_WINDOW, afterStep = -1 } = {}) {
  if (!isCodeFormat(code)) return null;
  const key = base32Decode(secretBase32);
  const given = Buffer.from(code);
  const current = stepAt(now);
  let matched = null;
  for (let step = current - window; step <= current + window; step += 1) {
    const expected = Buffer.from(hotp(key, step));
    if (crypto.timingSafeEqual(expected, given) && step > afterStep && matched === null) matched = step;
  }
  return matched;
}

export const newSecret = () => base32Encode(crypto.randomBytes(20)); // 160 bits, the RFC 4226 recommendation

export function otpauthUrl(username, secretBase32) {
  const label = `${encodeURIComponent(TOTP_ISSUER)}:${encodeURIComponent(username)}`;
  const query = new URLSearchParams({
    secret: secretBase32,
    issuer: TOTP_ISSUER,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  });
  return `otpauth://totp/${label}?${query}`;
}

// ---- Secrets at rest ----
// The shared secret is stored encrypted (AES-256-GCM) with a key derived from JWT_SECRET by HKDF-SHA256, so a copy
// of the database alone does not give an attacker the second factor. Changing JWT_SECRET makes stored TOTP secrets
// unreadable: every user with TOTP must set it up again (docs/ADMIN.md).

export function encryptSecret(secretBase32) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey('totp-secret-encryption-v1'), iv);
  const data = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

// Returns the base32 secret, or null when the stored value is missing, damaged or was made with another key.
export function decryptSecret(stored) {
  try {
    const [version, iv, tag, data] = String(stored).split('.');
    if (version !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey('totp-secret-encryption-v1'), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
