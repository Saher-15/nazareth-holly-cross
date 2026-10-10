import bcrypt from 'bcryptjs';

// Password hashing for the admin accounts of the dashboard (route/admin/auth.js, route/admin/users.js,
// services/passwordReset.js, scripts/create-admin.js).
//
// The two legacy sign-ins (POST /auth/login with the shared ADMIN_PASSWORD, POST /admin/login with an account's
// password, both giving an 8-hour token with no session) were REMOVED on 2026-10-07 (security review 06, finding 1):
// they skipped the second factor, roles, disabling, lockout, revocation and the audit log. The dashboard signs in with
// POST /admin/auth/login only (docs/ADMIN.md 3.1); a token without a live session is refused everywhere
// (middleware/adminGuard.js, services/adminSessions.js).

// bcrypt work factor for every password hash made from now on (accounts hashed with a lower cost stay valid).
export const BCRYPT_COST = 12;
export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_COST);

// A password check that takes as long for an unknown username as for a wrong password,
// so response time does not reveal which usernames exist.
let dummyHash;
export async function comparePasswordTimingSafe(admin, password) {
  dummyHash ??= bcrypt.hashSync('not-a-real-password', BCRYPT_COST);
  const text = typeof password === 'string' ? password : '';
  if (!admin) {
    await bcrypt.compare(text, dummyHash);
    return false;
  }
  return admin.comparePassword(text);
}
