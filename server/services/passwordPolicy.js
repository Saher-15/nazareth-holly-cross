// The password rules for admin accounts (docs/ADMIN.md): at least 12 characters, not the username, not a
// well-known password. Returns null when the password is acceptable, otherwise a short reason that is safe to
// show to the person typing it.

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200; // bcrypt only reads the first 72 bytes; the cap keeps hashing cheap to request

// Passwords that appear at the top of every leaked-password list, in the shapes people use to get past a
// length rule (a long word, a keyboard walk, a year added to a name). Compared case-insensitively and without
// separators. Deliberately small: the length rule does most of the work.
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

const normalise = (text) => text.toLowerCase().replace(/[\s._-]+/g, '');

export function checkPasswordPolicy(password, username = '') {
  if (typeof password !== 'string') return 'Password must be text';
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  const flat = normalise(password);
  const name = normalise(String(username ?? ''));
  // The username itself, or the username with a few characters added ("saher2026!!").
  if (name && (flat === name || (flat.includes(name) && name.length >= 4 && flat.length - name.length < 4))) {
    return 'Password must not be the username';
  }
  if (COMMON.has(flat)) return 'Password is too common';
  if (new Set(password).size < 4) return 'Password is too repetitive';
  return null;
}
