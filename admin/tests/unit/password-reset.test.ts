import { describe, expect, it } from 'vitest';
import { API_BAD_LINK, isResetToken, policyReason, resetFailureFrom, tokenFromParam } from '@/lib/password-reset';

// Forgotten password (src/lib/password-reset.ts): which links are accepted and how the API's 400 answers become the
// codes the reset page translates.

const TOKEN = 'Ab0_-'.repeat(8) + 'xyz'; // 43 base64url characters

describe('reset token', () => {
  it('accepts exactly 43 base64url characters', () => {
    expect(TOKEN).toHaveLength(43);
    expect(isResetToken(TOKEN)).toBe(true);
    for (const bad of ['', 'short', `${TOKEN}a`, TOKEN.slice(1), `${TOKEN.slice(0, 42)}=`, `${TOKEN.slice(0, 42)}/`, `${TOKEN.slice(0, 42)} `, null, 42]) {
      expect(isResetToken(bad), String(bad)).toBe(false);
    }
  });

  it('reads the first search parameter and ignores anything that is not a token', () => {
    expect(tokenFromParam(TOKEN)).toBe(TOKEN);
    expect(tokenFromParam([TOKEN, 'other'])).toBe(TOKEN);
    expect(tokenFromParam(undefined)).toBeNull();
    expect(tokenFromParam('<script>')).toBeNull();
  });
});

describe('reset-password answers', () => {
  it('a bad, used or expired link becomes "link" (nothing else from the API is passed on)', () => {
    expect(resetFailureFrom(API_BAD_LINK)).toEqual({ error: 'link' });
  });

  it('each rule of the server\'s password policy has its own reason, so the page can translate it', () => {
    expect(policyReason('Password must be at least 12 characters')).toBe('short');
    expect(policyReason('Password must be at most 200 characters')).toBe('long');
    expect(policyReason('Password must not be the username')).toBe('username');
    expect(policyReason('Password is too common')).toBe('common');
    expect(policyReason('Password is too repetitive')).toBe('repetitive');
    expect(policyReason('Choose a password')).toBeNull();
    expect(resetFailureFrom('Password is too common')).toEqual({ error: 'policy', reason: 'common', message: 'Password is too common' });
    expect(resetFailureFrom('Choose a password')).toEqual({ error: 'policy', reason: null, message: 'Choose a password' });
  });
});
