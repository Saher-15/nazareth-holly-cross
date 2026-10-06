// The password policy the API enforces (server/services/passwordPolicy.js): at least 12 characters, at most 200, not
// the username (nor the username with a few characters added), not a well-known password, at least 4 different
// characters. The server is the authority; this copy gives an instant, translated message for every rule it applies,
// so the person never sees the API's English text instead. Keep the two in step (tests/unit/helpers.test.ts).

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

// The server's list, compared case-insensitively and without separators.
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'password12345', 'password123456',
  'passw0rd1234', 'p@ssw0rd1234', 'letmein12345', 'welcome12345', 'welcome123456', 'administrator',
  'administrator1', 'administrator123', 'adminadmin12', 'adminadmin123', 'admin1234567', 'admin12345678',
  'admin123456789', 'qwertyuiop12', 'qwertyuiop123', 'qwerty123456', 'qwerty1234567', 'qwertyuiopas',
  'asdfghjkl123', 'asdfghjklqwe', 'zxcvbnm12345', '1q2w3e4r5t6y', '1qaz2wsx3edc', '123456789012',
  '1234567890123', '12345678901234', '123456789abc', 'abcdefghijkl', 'abcd12345678', 'iloveyou1234',
  'iloveyou12345', 'monkey123456', 'dragon123456', 'football1234', 'baseball1234', 'superman1234',
  'changeme1234', 'changemenow1', 'nazareth1234', 'nazareth12345', 'nazarethholycross', 'holycross1234',
  'holycross12345', 'jerusalem123', 'jerusalem1234', 'letmeinplease', 'trustno1trustno1',
  '000000000000', '111111111111', 'aaaaaaaaaaaa',
]);

export type PasswordProblem = 'short' | 'long' | 'username' | 'common' | 'repetitive';

/**
 * A username the dashboard creates: 3 to 40 of a-z 0-9 . _ - starting with a letter or digit. The API (route/admin/
 * users.js) takes 3 to 64 and A-Z too, but refuses a name that starts with ".", "_" or "-"; the form sends it lower-cased.
 */
export const isUsername = (value: string) => /^[a-z0-9][a-z0-9._-]{2,39}$/.test(value);

const normalise = (text: string) => text.toLowerCase().replace(/[\s._-]+/g, '');

export function passwordProblem(password: string, username: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'short';
  if (password.length > MAX_PASSWORD_LENGTH) return 'long';
  const flat = normalise(password);
  const name = normalise(username ?? '');
  if (name && (flat === name || (flat.includes(name) && name.length >= 4 && flat.length - name.length < 4))) return 'username';
  if (COMMON.has(flat)) return 'common';
  if (new Set(password).size < 4) return 'repetitive';
  return null;
}
