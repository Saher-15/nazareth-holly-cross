import { describe, it, expect } from 'vitest';
import {
  base32Decode, base32Encode, decryptSecret, encryptSecret, hotp, isCodeFormat, newSecret, otpauthUrl, stepAt, totp, verifyTotp,
} from '../services/totp.js';
import { config } from '../config/env.js';

// RFC 6238 appendix B and RFC 4226 appendix D test vectors, and the secret storage.

const RFC_KEY = Buffer.from('12345678901234567890'); // the ASCII secret every RFC test vector uses
const RFC_SECRET_B32 = base32Encode(RFC_KEY);

describe('base32 (RFC 4648 test vectors)', () => {
  it.each([
    ['', ''], ['f', 'MY'], ['fo', 'MZXQ'], ['foo', 'MZXW6'], ['foob', 'MZXW6YQ'], ['fooba', 'MZXW6YTB'], ['foobar', 'MZXW6YTBOI'],
  ])('%j <-> %s', (text, encoded) => {
    expect(base32Encode(Buffer.from(text))).toBe(encoded);
    expect(base32Decode(encoded).toString()).toBe(text);
  });

  it('decodes lower case, spaces, dashes and padding as authenticator apps display them', () => {
    expect(base32Decode('mzxw 6ytb-oi======').toString()).toBe('foobar');
  });

  it('refuses characters outside the alphabet', () => {
    expect(() => base32Decode('MZXW1')).toThrow();
  });

  it('round-trips random bytes', () => {
    const bytes = Buffer.from(Array.from({ length: 20 }, (_, i) => (i * 37 + 11) & 255));
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
  });
});

describe('HOTP (RFC 4226 appendix D)', () => {
  const vectors = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  it.each(vectors.map((code, counter) => [counter, code]))('counter %i -> %s', (counter, code) => {
    expect(hotp(RFC_KEY, counter)).toBe(code);
  });
});

describe('TOTP (RFC 6238 appendix B, SHA-1, 8 digits)', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('T = %i s -> %s', (seconds, code) => {
    expect(totp(RFC_SECRET_B32, seconds * 1000, { digits: 8 })).toBe(code);
  });

  it('with 6 digits (what authenticator apps use) the code is the last six digits of the 8-digit one', () => {
    expect(totp(RFC_SECRET_B32, 59_000)).toBe('287082');
    expect(totp(RFC_SECRET_B32, 1111111109_000)).toBe('081804');
  });

  it('a step is 30 seconds', () => {
    expect(stepAt(59_000)).toBe(1);
    expect(stepAt(60_000)).toBe(2);
  });
});

describe('verifyTotp', () => {
  const now = 1111111109_000;
  const step = stepAt(now);
  const at = (offset) => totp(RFC_SECRET_B32, now + offset * 30_000);

  it('accepts the current code and returns its step', () => {
    expect(verifyTotp(RFC_SECRET_B32, at(0), { now })).toBe(step);
  });

  it('accepts one step either side (clock drift) and no more', () => {
    expect(verifyTotp(RFC_SECRET_B32, at(-1), { now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET_B32, at(1), { now })).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET_B32, at(-2), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET_B32, at(2), { now })).toBeNull();
  });

  it('refuses a code that was already used (replay) and any older one', () => {
    expect(verifyTotp(RFC_SECRET_B32, at(0), { now, afterStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET_B32, at(-1), { now, afterStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET_B32, at(1), { now, afterStep: step })).toBe(step + 1);
  });

  it('refuses anything that is not six digits', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 456', 123456, null, undefined, ['123456'], { a: 1 }]) {
      expect(verifyTotp(RFC_SECRET_B32, bad, { now }), String(bad)).toBeNull();
    }
    expect(isCodeFormat('000000')).toBe(true);
    expect(isCodeFormat('00000a')).toBe(false);
  });

  it('refuses a wrong code', () => {
    const right = at(0);
    const wrong = right === '000000' ? '000001' : '000000';
    expect(verifyTotp(RFC_SECRET_B32, wrong, { now })).toBeNull();
  });
});

describe('secret generation and the otpauth URL', () => {
  it('makes a 160-bit secret in base32 and never the same twice', () => {
    const a = newSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(a)).toHaveLength(20);
    expect(newSecret()).not.toBe(a);
  });

  it('builds the URL authenticator apps import', () => {
    const url = new URL(otpauthUrl('saher.admin', 'JBSWY3DPEHPK3PXP'));
    expect(url.protocol).toBe('otpauth:');
    expect(url.hostname).toBe('totp');
    expect(decodeURIComponent(url.pathname)).toBe('/Nazareth Holy Cross:saher.admin');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      secret: 'JBSWY3DPEHPK3PXP', issuer: 'Nazareth Holy Cross', algorithm: 'SHA1', digits: '6', period: '30',
    });
  });

  it('escapes a username that would break the label', () => {
    expect(otpauthUrl('a b/c', 'AAAA')).toContain('a%20b%2Fc');
  });
});

describe('the secret at rest (AES-256-GCM, key from JWT_SECRET by HKDF)', () => {
  it('encrypts and decrypts, and the stored text does not contain the secret', () => {
    const secret = newSecret();
    const stored = encryptSecret(secret);
    expect(stored.startsWith('v1.')).toBe(true);
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored)).toBe(secret);
  });

  it('uses a new random IV each time', () => {
    expect(encryptSecret('AAAA')).not.toBe(encryptSecret('AAAA'));
  });

  it('returns null for damaged, truncated, empty or foreign values', () => {
    const stored = encryptSecret(newSecret());
    const [v, iv, tag, data] = stored.split('.');
    expect(decryptSecret(`${v}.${iv}.${tag}.${data.slice(0, -2)}AA`)).toBeNull(); // tampered ciphertext
    expect(decryptSecret(`${v}.${iv}.${Buffer.alloc(16).toString('base64url')}.${data}`)).toBeNull(); // wrong tag
    expect(decryptSecret(`v2.${iv}.${tag}.${data}`)).toBeNull();
    for (const bad of [null, undefined, '', 'junk', 'v1.a.b']) expect(decryptSecret(bad)).toBeNull();
  });

  it('cannot be read after JWT_SECRET changes', () => {
    const stored = encryptSecret('JBSWY3DPEHPK3PXP');
    const original = config.jwtSecret;
    config.jwtSecret = 'another-secret-another-secret-another-secret';
    try {
      expect(decryptSecret(stored)).toBeNull();
    } finally {
      config.jwtSecret = original;
    }
    expect(decryptSecret(stored)).toBe('JBSWY3DPEHPK3PXP');
  });
});
