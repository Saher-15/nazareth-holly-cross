import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// The dashboard's own sign-in: POST /admin/auth/login, sessions and revocation, lockout, TOTP, password change.

vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));

const { fakes, quickHash } = await import('./helpers/fakes.js');
const { PASSWORD, freshIp, seedAdmin, signedIn, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { signSessionToken, SESSION_SECONDS } = await import('../services/adminSessions.js');
const { encryptSecret, newSecret, totp, stepAt } = await import('../services/totp.js');

const SECRET = process.env.JWT_SECRET;
const { http, close } = startClient(createApp());
afterAll(close);

beforeEach(() => {
  fakes.Admin.reset();
  fakes.AdminSession.reset();
  fakes.AuditLog.reset();
});

const login = (body, ip = freshIp()) => http.post('/admin/auth/login').set('X-Forwarded-For', ip).send(body);
const get = (path, token) => http.get(path).set('X-Forwarded-For', freshIp()).set(...(token ? ['Authorization', `Bearer ${token}`] : ['X-None', '1']));
const audits = (action) => fakes.AuditLog.docs.filter((d) => !action || d.action === action);
const sign = (claims, options = { expiresIn: '10m' }, key = SECRET) => jwt.sign(claims, key, options);

describe('POST /admin/auth/login', () => {
  it('signs in and answers token, expiresIn and the user', async () => {
    const admin = seedAdmin({ username: 'saher', role: 'editor' });
    const res = await login({ username: 'saher', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      token: expect.any(String),
      expiresIn: 3600,
      user: { id: admin._id, username: 'saher', role: 'editor', totpEnabled: false },
    });
  });

  it('issues an HS256 token valid for 60 minutes with exactly sub, role and sid', async () => {
    const admin = seedAdmin({ username: 'saher' });
    const { body } = await login({ username: 'saher', password: PASSWORD });
    const decoded = jwt.verify(body.token, SECRET, { algorithms: ['HS256'], complete: true });
    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.payload.exp - decoded.payload.iat).toBe(SESSION_SECONDS);
    expect(SESSION_SECONDS).toBe(3600);
    expect(Object.keys(decoded.payload).sort()).toEqual(['exp', 'iat', 'role', 'sid', 'sub']);
    expect(decoded.payload).toMatchObject({ sub: admin._id, role: 'owner' });
    const session = fakes.AdminSession.docs.find((s) => s.sid === decoded.payload.sid);
    expect(session).toBeTruthy();
    expect(String(session.admin)).toBe(admin._id);
    expect(session.expiresAt.getTime() - Date.now()).toBeGreaterThan(3590_000);
  });

  it('records lastLoginAt and writes an audit entry without the password', async () => {
    const admin = seedAdmin({ username: 'saher' });
    await login({ username: 'saher', password: PASSWORD });
    expect(fakes.Admin.byId(admin._id).lastLoginAt).toBeInstanceOf(Date);
    const [entry] = audits('auth.login');
    expect(entry).toMatchObject({ actorName: 'saher', role: 'owner', target: { type: 'admin', id: admin._id } });
    expect(JSON.stringify(fakes.AuditLog.docs)).not.toContain(PASSWORD);
  });

  it('treats an account written before roles existed as an enabled owner', async () => {
    fakes.Admin.seed([{ username: 'old', password: quickHash('old-password-123') }], { raw: true });
    const res = await login({ username: 'old', password: 'old-password-123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('owner');
    expect((await get('/admin/auth/me', res.body.token)).body).toMatchObject({ username: 'old', role: 'owner', totpEnabled: false });
  });

  it('answers every failure with the same 401 and body', async () => {
    seedAdmin({ username: 'real' });
    seedAdmin({ username: 'off', disabled: true });
    seedAdmin({ username: 'locked', lockedUntil: new Date(Date.now() + 600_000) });
    const attempts = [
      { username: 'real', password: 'wrong-password' },
      { username: 'ghost', password: PASSWORD },
      { username: 'off', password: PASSWORD },
      { username: 'locked', password: PASSWORD },
      {},
      { username: 'real' },
      { username: 'real', password: 12345 },
      { username: { $ne: null }, password: { $ne: null } },
      { username: ['real'], password: [PASSWORD] },
      { username: 'real', password: PASSWORD, totp: 123456 },
      { username: 'x'.repeat(101), password: 'p' },
      { username: 'real', password: 'p'.repeat(201) },
    ];
    for (const body of attempts) {
      const res = await login(body);
      expect(res.status, JSON.stringify(body)).toBe(401);
      expect(res.body, JSON.stringify(body)).toEqual({ error: 'Invalid credentials' });
    }
    expect(fakes.AdminSession.docs).toHaveLength(0);
  });

  it('never lets an operator object reach the database query', async () => {
    seedAdmin({ username: 'real' });
    await login({ username: { $ne: null }, password: PASSWORD });
    await login({ username: { $gt: '' }, password: PASSWORD });
    expect(fakes.Admin.calls.filter((c) => c.op === 'findOne')).toHaveLength(0);
  });

  it('logs the reason internally (not to the client) and never the password', async () => {
    seedAdmin({ username: 'real' });
    await login({ username: 'real', password: 'wrong-password-123' });
    await login({ username: 'ghost\nFAKE', password: 'wrong-password-456' });
    const failures = audits('auth.login_failed');
    expect(failures.map((f) => f.meta.reason)).toEqual(['wrong_password', 'unknown_user']);
    expect(failures[1].actorName).not.toContain('\n');
    expect(JSON.stringify(failures)).not.toMatch(/wrong-password/);
  });

  it('sends no password hash, TOTP secret or lockout details to the client', async () => {
    seedAdmin({ username: 'saher', totpSecretEnc: 'v1.a.b.c' });
    const res = await login({ username: 'saher', password: PASSWORD });
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$|totpSecret|failedLogins|lockedUntil|password/i);
  });
});

describe('lockout: 5 consecutive failures lock the account for 15 minutes', () => {
  // A new client address for every try, so only the account lockout (not the rate limiter) is exercised.
  const fail = (username) => login({ username, password: 'wrong-password-1' });

  it('locks after the 5th failure, still answers 401, and refuses the right password while locked', async () => {
    const admin = seedAdmin({ username: 'victim' });
    for (let i = 0; i < 4; i += 1) expect((await fail('victim')).status).toBe(401);
    expect(fakes.Admin.byId(admin._id).failedLogins).toBe(4);
    expect(fakes.Admin.byId(admin._id).lockedUntil).toBeNull();

    expect((await fail('victim')).status).toBe(401);
    const locked = fakes.Admin.byId(admin._id);
    expect(locked.lockedUntil.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(locked.lockedUntil.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    expect(audits('auth.account_locked')).toHaveLength(1);

    const res = await login({ username: 'victim', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    expect(audits('auth.login_failed').at(-1).meta.reason).toBe('locked');
  });

  it('does not extend the lock while locked, and unlocks by itself after 15 minutes', async () => {
    const admin = seedAdmin({ username: 'victim', lockedUntil: new Date(Date.now() + 60_000) });
    const before = fakes.Admin.byId(admin._id).lockedUntil.getTime();
    await fail('victim');
    expect(fakes.Admin.byId(admin._id).lockedUntil.getTime()).toBe(before);

    fakes.Admin.byId(admin._id).lockedUntil = new Date(Date.now() - 1000); // the 15 minutes passed
    const res = await login({ username: 'victim', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(fakes.Admin.byId(admin._id)).toMatchObject({ failedLogins: 0, lockedUntil: null });
  });

  it('counts only consecutive failures: a success resets the counter', async () => {
    const admin = seedAdmin({ username: 'victim' });
    for (let i = 0; i < 4; i += 1) await fail('victim');
    expect((await login({ username: 'victim', password: PASSWORD })).status).toBe(200);
    expect(fakes.Admin.byId(admin._id).failedLogins).toBe(0);
    for (let i = 0; i < 4; i += 1) await fail('victim');
    expect(fakes.Admin.byId(admin._id).lockedUntil).toBeNull();
    expect((await login({ username: 'victim', password: PASSWORD })).status).toBe(200);
  });

  it('a failure for an unknown name changes nothing', async () => {
    const admin = seedAdmin({ username: 'victim' });
    for (let i = 0; i < 6; i += 1) await fail('nobody');
    expect(fakes.Admin.byId(admin._id).failedLogins).toBe(0);
  });
});

describe('rate limit: 5 failures per 15 minutes per address and username', () => {
  it('answers 429 on the 6th failure, even with the right password, and serves other names and addresses', async () => {
    seedAdmin({ username: 'rate-a' });
    seedAdmin({ username: 'rate-b' });
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) expect((await login({ username: 'rate-a', password: 'wrong-password-1' }, ip)).status).toBe(401);
    // (the account is locked now as well; the limiter answers before it is consulted)
    const blocked = await login({ username: 'rate-a', password: PASSWORD }, ip);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many login attempts/);
    expect((await login({ username: 'rate-b', password: PASSWORD }, ip)).status).toBe(200); // another name
    expect((await login({ username: 'rate-a', password: PASSWORD }, freshIp())).status).toBe(401); // locked, but not rate limited
  });

  it('is not reset by changing the username: 30 failures per address in all', async () => {
    const ip = freshIp();
    let last;
    for (let i = 0; i < 31; i += 1) last = await login({ username: `nobody${i}`, password: 'wrong-password-1' }, ip);
    expect(last.status).toBe(429);
  });

  it('successful sign-ins and the TOTP prompt are not counted', async () => {
    seedAdmin({ username: 'rate-c' });
    const ip = freshIp();
    for (let i = 0; i < 8; i += 1) expect((await login({ username: 'rate-c', password: PASSWORD }, ip)).status).toBe(200);
    seedAdmin({ username: 'rate-d', totpEnabled: true, totpSecretEnc: encryptSecret(newSecret()) });
    for (let i = 0; i < 8; i += 1) expect((await login({ username: 'rate-d', password: PASSWORD }, ip)).status).toBe(428);
  });
});

describe('two-factor sign-in (TOTP)', () => {
  const setup = (extra = {}) => {
    const secret = newSecret();
    const admin = seedAdmin({ username: 'twofa', totpEnabled: true, totpSecretEnc: encryptSecret(secret), ...extra });
    return { secret, admin };
  };

  it('asks for the code (428 totp_required) after a correct password when it is missing or not six digits', async () => {
    setup();
    for (const extra of [{}, { totp: '' }, { totp: '12345' }, { totp: 'abcdef' }, { totp: '1234567' }]) {
      const res = await login({ username: 'twofa', password: PASSWORD, ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(428);
      expect(res.body).toEqual({ error: 'totp_required' });
    }
    expect(fakes.AdminSession.docs).toHaveLength(0);
  });

  it('does not say a second factor exists when the password is wrong', async () => {
    setup();
    const res = await login({ username: 'twofa', password: 'wrong-password-1' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('signs in with the current code', async () => {
    const { secret } = setup();
    const res = await login({ username: 'twofa', password: PASSWORD, totp: totp(secret) });
    expect(res.status).toBe(200);
    expect(res.body.user.totpEnabled).toBe(true);
  });

  it('refuses a wrong code with the generic 401 and counts it toward the lockout', async () => {
    const { secret, admin } = setup();
    const good = totp(secret);
    const wrong = good === '000000' ? '000001' : '000000';
    const res = await login({ username: 'twofa', password: PASSWORD, totp: wrong });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    expect(fakes.Admin.byId(admin._id).failedLogins).toBe(1);
    expect(audits('auth.login_failed')[0].meta.reason).toBe('wrong_totp');
  });

  it('refuses a code that was already used (replay), and remembers the step', async () => {
    const { secret, admin } = setup();
    const code = totp(secret);
    expect((await login({ username: 'twofa', password: PASSWORD, totp: code })).status).toBe(200);
    expect(fakes.Admin.byId(admin._id).totpLastStep).toBeGreaterThanOrEqual(stepAt(Date.now()) - 1);
    expect((await login({ username: 'twofa', password: PASSWORD, totp: code })).status).toBe(401);
  });

  it('a stored secret that can no longer be decrypted never signs anyone in, and does not lock the account', async () => {
    const admin = seedAdmin({ username: 'broken', totpEnabled: true, totpSecretEnc: 'v1.bad.bad.bad' });
    for (let i = 0; i < 6; i += 1) expect((await login({ username: 'broken', password: PASSWORD, totp: '123456' })).status).toBe(401);
    expect(fakes.Admin.byId(admin._id).lockedUntil).toBeNull();
    expect(audits('auth.login_failed')[0].meta.reason).toBe('totp_secret_unreadable');
  });
});

describe('the token guard (any protected route; GET /admin/auth/me here)', () => {
  it('serves a live session and answers id, username, role, totpEnabled and lastLoginAt', async () => {
    const { admin, token } = await signedIn(signSessionToken, { username: 'saher', role: 'viewer', lastLoginAt: new Date('2026-10-01T08:00:00Z') });
    const res = await get('/admin/auth/me', token);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({ id: admin._id, username: 'saher', role: 'viewer', totpEnabled: false, lastLoginAt: '2026-10-01T08:00:00.000Z' });
  });

  it.each([
    ['no header', undefined],
    ['garbage', 'not.a.jwt'],
    ['a token signed with another secret', sign({ sub: 'a'.repeat(24), role: 'owner', sid: 'x' }, { expiresIn: '10m' }, 'another-secret-another-secret-xx')],
    ['an expired token', sign({ sub: 'a'.repeat(24), role: 'owner', sid: 'x' }, { expiresIn: -60 })],
    ['another algorithm', sign({ sub: 'a'.repeat(24), role: 'owner', sid: 'x' }, { expiresIn: '10m', algorithm: 'HS512' })],
    ['no session id', sign({ sub: 'a'.repeat(24), role: 'owner' })],
    ['an unknown role', sign({ sub: 'a'.repeat(24), role: 'superuser', sid: 'x' })],
    ['a session id that does not exist', sign({ sub: 'a'.repeat(24), role: 'owner', sid: 'nope' })],
    ['a token that lives for a week', sign({ sub: 'a'.repeat(24), role: 'owner', sid: 'x' }, { expiresIn: '7d' })],
  ])('refuses %s', async (_name, token) => {
    const res = await get('/admin/auth/me', token);
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('refuses alg "none"', async () => {
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'a'.repeat(24), role: 'owner', sid: 'x', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url')}.`;
    expect((await get('/admin/auth/me', none)).status).toBe(401);
  });

  it('refuses a wrong scheme', async () => {
    const { token } = await signedIn(signSessionToken);
    const res = await http.get('/admin/auth/me').set('X-Forwarded-For', freshIp()).set('Authorization', `Basic ${token}`);
    expect(res.status).toBe(401);
  });

  it('refuses a session that was revoked, expired, never existed, or belongs to someone else', async () => {
    const a = await signedIn(signSessionToken);
    fakes.AdminSession.docs.find((s) => s.sid === a.sid).revokedAt = new Date();
    expect((await get('/admin/auth/me', a.token)).status).toBe(401);

    const b = await signedIn(signSessionToken);
    fakes.AdminSession.docs.find((s) => s.sid === b.sid).expiresAt = new Date(Date.now() - 1000);
    expect((await get('/admin/auth/me', b.token)).status).toBe(401);

    const c = await signedIn(signSessionToken);
    const other = seedAdmin();
    fakes.AdminSession.docs.find((s) => s.sid === c.sid).admin = other._id;
    expect((await get('/admin/auth/me', c.token)).status).toBe(401);
  });

  it('refuses a disabled or deleted account at once, and applies a role change at once', async () => {
    const a = await signedIn(signSessionToken, { role: 'owner' });
    expect((await get('/admin/auth/me', a.token)).body.role).toBe('owner');
    fakes.Admin.byId(a.admin._id).role = 'viewer';
    expect((await get('/admin/auth/me', a.token)).body.role).toBe('viewer'); // the token still says owner; the database wins
    fakes.Admin.byId(a.admin._id).disabled = true;
    expect((await get('/admin/auth/me', a.token)).status).toBe(401);

    const b = await signedIn(signSessionToken);
    fakes.Admin.docs.splice(fakes.Admin.docs.indexOf(fakes.Admin.byId(b.admin._id)), 1);
    expect((await get('/admin/auth/me', b.token)).status).toBe(401);
  });

  it('does not accept the old admin tokens (shared password / old account) on the dashboard routes', async () => {
    const shared = (await http.post('/auth/login').set('X-Forwarded-For', freshIp()).send({ password: process.env.ADMIN_PASSWORD })).body.token;
    expect(shared).toBeTruthy();
    expect((await get('/admin/auth/me', shared)).status).toBe(401);
    expect((await get('/admin/dashboard', shared)).status).toBe(401);
    expect((await get('/admin/orders', shared)).status).toBe(401);
    expect((await get('/admin/users', shared)).status).toBe(401);
    expect((await get('/admin/audit', shared)).status).toBe(401);
  });
});

describe('POST /admin/auth/logout', () => {
  it('answers 204 and the token stops working at once; other sessions stay', async () => {
    const a = await signedIn(signSessionToken);
    const otherSid = 'sid-other';
    fakes.AdminSession.seed([{ sid: otherSid, admin: a.admin._id, expiresAt: new Date(Date.now() + 3600_000), revokedAt: null }]);
    const otherToken = signSessionToken({ id: a.admin._id, role: 'owner' }, otherSid);

    const res = await http.post('/admin/auth/logout').set('X-Forwarded-For', freshIp()).set(a.auth);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(fakes.AdminSession.docs.find((s) => s.sid === a.sid).revokedAt).toBeInstanceOf(Date);
    expect((await get('/admin/auth/me', a.token)).status).toBe(401);
    expect((await get('/admin/auth/me', otherToken)).status).toBe(200);
    expect(audits('auth.logout')).toHaveLength(1);
  });

  it('needs a token', async () => {
    expect((await http.post('/admin/auth/logout').set('X-Forwarded-For', freshIp())).status).toBe(401);
  });
});

describe('POST /admin/auth/password', () => {
  const change = (auth, body) => http.post('/admin/auth/password').set('X-Forwarded-For', freshIp()).set(auth).send(body);
  const NEW = 'a brand new passphrase';

  it('changes the password (hashed with cost 12), signs out the other sessions, keeps this one', async () => {
    const a = await signedIn(signSessionToken, { username: 'saher' });
    const other = await signedIn(signSessionToken, { username: 'someone' }); // another account: untouched
    const sid2 = 'sid-second-device';
    fakes.AdminSession.seed([{ sid: sid2, admin: a.admin._id, expiresAt: new Date(Date.now() + 3600_000), revokedAt: null }]);
    const token2 = signSessionToken({ id: a.admin._id, role: 'owner' }, sid2);

    const res = await change(a.auth, { currentPassword: PASSWORD, newPassword: NEW });
    expect(res.status).toBe(204);
    expect(bcrypt.getRounds(fakes.Admin.byId(a.admin._id).password)).toBe(12);
    expect((await get('/admin/auth/me', a.token)).status).toBe(200);
    expect((await get('/admin/auth/me', token2)).status).toBe(401);
    expect((await get('/admin/auth/me', other.token)).status).toBe(200);
    expect(audits('auth.password_change')).toHaveLength(1);
    expect(JSON.stringify(fakes.AuditLog.docs)).not.toContain(NEW);

    expect((await login({ username: 'saher', password: PASSWORD })).status).toBe(401);
    expect((await login({ username: 'saher', password: NEW })).status).toBe(200);
  });

  it('keeps passwords with & < > " exactly as typed (the HTML sanitizer must not touch them)', async () => {
    const a = await signedIn(signSessionToken, { username: 'saher' });
    const tricky = 'R&D <team> "pass" 12345';
    expect((await change(a.auth, { currentPassword: PASSWORD, newPassword: tricky })).status).toBe(204);
    expect(await bcrypt.compare(tricky, fakes.Admin.byId(a.admin._id).password)).toBe(true);
    expect((await login({ username: 'saher', password: tricky })).status).toBe(200);
  });

  it('refuses a wrong current password (403) and audits it', async () => {
    const a = await signedIn(signSessionToken);
    const res = await change(a.auth, { currentPassword: 'not my password', newPassword: NEW });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Current password is incorrect' });
    expect(audits('auth.password_change_failed')).toHaveLength(1);
    expect(await bcrypt.compare(PASSWORD, fakes.Admin.byId(a.admin._id).password)).toBe(true);
  });

  it.each([
    ['shorter than 12 characters', 'Sh0rt!pass', /at least 12/],
    ['a common password', 'password1234', /common/],
    ['the username', 'saher.the.admin', /username/],
    ['the same as now', PASSWORD, /differ/],
  ])('refuses a new password that is %s', async (_n, newPassword, message) => {
    const a = await signedIn(signSessionToken, { username: 'saher.the.admin' });
    const res = await change(a.auth, { currentPassword: PASSWORD, newPassword });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  it('validates the body strictly', async () => {
    // (every refused attempt counts toward the per-account limit of 5, so each body gets its own account)
    for (const body of [{}, { currentPassword: PASSWORD }, { newPassword: NEW }, { currentPassword: 5, newPassword: NEW }, { currentPassword: PASSWORD, newPassword: ['x'] }, { currentPassword: PASSWORD, newPassword: NEW, role: 'owner' }]) {
      const a = await signedIn(signSessionToken);
      expect((await change(a.auth, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('stops a stolen token from guessing the current password: 5 failures, then 429', async () => {
    const a = await signedIn(signSessionToken);
    for (let i = 0; i < 5; i += 1) expect((await change(a.auth, { currentPassword: `guess number ${i}`, newPassword: NEW })).status).toBe(403);
    const res = await change(a.auth, { currentPassword: PASSWORD, newPassword: NEW });
    expect(res.status).toBe(429);
  });

  it('needs a token', async () => {
    expect((await http.post('/admin/auth/password').set('X-Forwarded-For', freshIp()).send({ currentPassword: PASSWORD, newPassword: NEW })).status).toBe(401);
  });
});

describe('two-factor setup, enable and disable', () => {
  const post = (path, auth, body) => http.post(path).set('X-Forwarded-For', freshIp()).set(auth).send(body);
  const currentCode = (secret) => totp(secret);

  it('full cycle: setup -> enable -> sign-in needs a code -> disable', async () => {
    const a = await signedIn(signSessionToken, { username: 'cycle' });

    const setup = await post('/admin/auth/totp/setup', a.auth);
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.body.otpauthUrl).toContain('otpauth://totp/');
    expect(setup.body.otpauthUrl).toContain(`secret=${setup.body.secret}`);
    const stored = fakes.Admin.byId(a.admin._id);
    expect(stored.totpEnabled).toBe(false); // not on until a code proves the app has it
    expect(stored.totpSecretEnc).toMatch(/^v1\./);
    expect(JSON.stringify(stored)).not.toContain(setup.body.secret); // encrypted at rest

    expect((await login({ username: 'cycle', password: PASSWORD })).status).toBe(200); // still password only

    expect((await post('/admin/auth/totp/enable', a.auth, { code: '000000' === currentCode(setup.body.secret) ? '000001' : '000000' })).status).toBe(400);
    const enable = await post('/admin/auth/totp/enable', a.auth, { code: currentCode(setup.body.secret) });
    expect(enable.status).toBe(204);
    expect(fakes.Admin.byId(a.admin._id).totpEnabled).toBe(true);
    expect((await get('/admin/auth/me', a.token)).body.totpEnabled).toBe(true);

    expect((await login({ username: 'cycle', password: PASSWORD })).status).toBe(428);

    // The code just used for enable() cannot be replayed to disable it.
    const wrongPassword = await post('/admin/auth/totp/disable', a.auth, { password: 'not my password', code: currentCode(setup.body.secret) });
    expect(wrongPassword.status).toBe(403);
    const replay = await post('/admin/auth/totp/disable', a.auth, { password: PASSWORD, code: currentCode(setup.body.secret) });
    expect(replay.status).toBe(403);
    // A code from the next step is fresh.
    const next = totp(setup.body.secret, Date.now() + 30_000);
    const disable = await post('/admin/auth/totp/disable', a.auth, { password: PASSWORD, code: next });
    expect(disable.status).toBe(204);
    expect(fakes.Admin.byId(a.admin._id)).toMatchObject({ totpEnabled: false, totpSecretEnc: null });
    expect((await login({ username: 'cycle', password: PASSWORD })).status).toBe(200);
    expect(audits().map((e) => e.action)).toEqual(expect.arrayContaining(['auth.totp_setup', 'auth.totp_enable', 'auth.totp_disable', 'auth.totp_disable_failed']));
  });

  it('setup refuses while TOTP is on; enable refuses without a setup, with a bad format, or twice', async () => {
    const a = await signedIn(signSessionToken);
    expect((await post('/admin/auth/totp/enable', a.auth, { code: '123456' })).status).toBe(409); // no setup yet
    expect((await post('/admin/auth/totp/enable', a.auth, { code: '12345' })).status).toBe(400);
    expect((await post('/admin/auth/totp/enable', a.auth, { code: 123456 })).status).toBe(400);
    expect((await post('/admin/auth/totp/enable', a.auth, {})).status).toBe(400);

    const { body } = await post('/admin/auth/totp/setup', a.auth);
    expect((await post('/admin/auth/totp/enable', a.auth, { code: currentCode(body.secret) })).status).toBe(204);
    expect((await post('/admin/auth/totp/setup', a.auth)).status).toBe(409);
    expect((await post('/admin/auth/totp/enable', a.auth, { code: totp(body.secret, Date.now() + 30_000) })).status).toBe(409);
  });

  it('disable refuses when TOTP is not enabled and checks its body', async () => {
    const a = await signedIn(signSessionToken);
    expect((await post('/admin/auth/totp/disable', a.auth, { password: PASSWORD, code: '123456' })).status).toBe(409);
    expect((await post('/admin/auth/totp/disable', a.auth, { password: PASSWORD })).status).toBe(400);
    expect((await post('/admin/auth/totp/disable', a.auth, { code: '123456' })).status).toBe(400);
  });

  it('enabling signs out the account\'s other sessions', async () => {
    const a = await signedIn(signSessionToken, { username: 'two-sessions' });
    fakes.AdminSession.seed([{ sid: 'sid-b', admin: a.admin._id, expiresAt: new Date(Date.now() + 3600_000), revokedAt: null }]);
    const tokenB = signSessionToken({ id: a.admin._id, role: 'owner' }, 'sid-b');
    const { body } = await post('/admin/auth/totp/setup', a.auth);
    await post('/admin/auth/totp/enable', a.auth, { code: currentCode(body.secret) });
    expect((await get('/admin/auth/me', tokenB)).status).toBe(401);
    expect((await get('/admin/auth/me', a.token)).status).toBe(200);
  });

  it('wrong enable codes are rate limited per account', async () => {
    const a = await signedIn(signSessionToken);
    await post('/admin/auth/totp/setup', a.auth);
    let last;
    for (let i = 0; i < 6; i += 1) last = await post('/admin/auth/totp/enable', a.auth, { code: '000000' });
    expect(last.status).toBe(429);
  });

  it('every totp route needs a token', async () => {
    for (const path of ['setup', 'enable', 'disable']) {
      expect((await http.post(`/admin/auth/totp/${path}`).set('X-Forwarded-For', freshIp()).send({})).status, path).toBe(401);
    }
  });
});
