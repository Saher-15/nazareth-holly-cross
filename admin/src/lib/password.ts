// The password policy the API enforces (>= 12 characters, not the username, not a very common password).
// The server is the authority; this check only gives an instant, translated hint before the request.

export const MIN_PASSWORD_LENGTH = 12;

const COMMON = new Set(['password1234', 'password12345', 'passw0rd1234', '123456789012', 'qwertyuiop12', 'letmein12345', 'administrator', 'welcome12345']);

export type PasswordProblem = 'short' | 'long' | 'username' | 'common';

export function passwordProblem(password: string, username: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'short';
  if (password.length > 200) return 'long';
  if (password.toLowerCase() === username.trim().toLowerCase()) return 'username';
  if (COMMON.has(password.toLowerCase())) return 'common';
  return null;
}
