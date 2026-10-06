// Forgotten password (docs/ADMIN.md, "Password reset"): the pure parts shared by the two session routes and the pages.
//
//   POST /admin/auth/forgot-password { email }           -> always 202 { ok: true } (never says whether the address exists)
//   POST /admin/auth/reset-password  { token, password } -> 204, or 400 for a bad link or a password the policy refuses
//
// The token is 32 random bytes in base64url (43 characters). It is a secret for 30 minutes: never logged, never echoed,
// never stored in the browser.

export const RESET_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function isResetToken(value: unknown): value is string {
  return typeof value === 'string' && RESET_TOKEN.test(value);
}

/** The first value of a search parameter, if it looks like a reset token; anything else is "no link". */
export function tokenFromParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return isResetToken(raw) ? raw : null;
}

/** The API's answer for a link that is invalid, already used or expired (server/route/admin/auth.js BAD_LINK). */
export const API_BAD_LINK = 'This link is invalid or has expired. Ask for a new one.';

export type PolicyReason = 'short' | 'long' | 'username' | 'common' | 'repetitive';

/** Which rule of the server's password policy (server/services/passwordPolicy.js) an API message names, if any. */
export function policyReason(message: string): PolicyReason | null {
  if (/at least \d+ characters/i.test(message)) return 'short';
  if (/at most \d+ characters/i.test(message)) return 'long';
  if (/username/i.test(message)) return 'username';
  if (/too common/i.test(message)) return 'common';
  if (/repetitive/i.test(message)) return 'repetitive';
  return null;
}

export type ResetFailure = { error: 'link' } | { error: 'policy'; reason: PolicyReason | null; message: string };

/** Turns the API's 400 for reset-password into a code the page translates. Only the API's own policy text passes on. */
export function resetFailureFrom(message: string): ResetFailure {
  if (message === API_BAD_LINK || /link/i.test(message)) return { error: 'link' };
  return { error: 'policy', reason: policyReason(message), message: message.slice(0, 200) };
}
