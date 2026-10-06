// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) with node:crypto only. Shared by the mock API and the tests.
import { createHmac, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = text.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateSecret() {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret, timeMs = Date.now(), stepSeconds = 30) {
  const counter = Math.floor(timeMs / 1000 / stepSeconds);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

/**
 * Like the real API: accepts the current step and one either side, returns the matching step, and refuses a step that
 * is not newer than `afterStep` (the last one used), so a code works once. Null when nothing matches.
 */
export function totpStep(secret, code, { afterStep = -1, timeMs = Date.now() } = {}) {
  if (!/^\d{6}$/.test(String(code ?? ''))) return null;
  const current = Math.floor(timeMs / 1000 / 30);
  for (let step = current - 1; step <= current + 1; step += 1) {
    if (totpCode(secret, step * 30_000) === code && step > afterStep) return step;
  }
  return null;
}

/** Accepts the current step and one step either side (clock drift). */
export function verifyTotp(secret, code, timeMs = Date.now()) {
  if (!/^\d{6}$/.test(String(code ?? '').trim())) return false;
  const wanted = String(code).trim();
  return [-1, 0, 1].some((drift) => totpCode(secret, timeMs + drift * 30_000) === wanted);
}

export function otpauthUrl(secret, account, issuer = 'Nazareth Holy Cross') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
