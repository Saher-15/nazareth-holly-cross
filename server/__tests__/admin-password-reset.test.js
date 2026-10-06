import { describe, it, expect, vi, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// Forgotten password: POST /admin/auth/forgot-password and /admin/auth/reset-password (services/passwordReset.js),
// including the creation of the first owner while no account exists.

vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
const sendMail = vi.fn(async () => true);
vi.mock('../services/emailService.js', () => ({ sendMail: (...a) => sendMail(...a), SENDER: {} }));

const { fakes } = await import('./helpers/fakes.js');
const { PASSWORD, freshIp, seedAdmin, startClient, allFilters, sanitizeChanges } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { RESET_MINUTES } = await import('../services/passwordReset.js');

const { http, close } = startClient(createApp());
afterAll(close);

const OWNER_EMAIL = 'nazarethholycross@gmail.com';
const NEW_PASSWORD = 'olive tree courtyard 77';

beforeEach(() => {
  fakes.Admin.reset();
  fakes.AdminSession.reset();
  fakes.AuditLog.reset();
  sendMail.mockClear();
});

const forgot = (email, ip = freshIp()) => http.post('/admin/auth/forgot-password').set('X-Forwarded-For', ip).send({ email });
const reset = (body, ip = freshIp()) => http.post('/admin/auth/reset-password').set('X-Forwarded-For', ip).send(body);
const login = (username, password) => http.post('/admin/auth/login').set('X-Forwarded-For', freshIp()).send({ username, password });
const mailedToken = (call = 0) => /token=([A-Za-z0-9_-]{43})/.exec(sendMail.mock.calls[call][0].text)[1];
const audits = (action) => fakes.AuditLog.docs.filter((d) => d.action === action);

describe('POST /admin/auth/forgot-password', () => {
  it('mails a one-time link to an account found by its e-mail, and answers 202 without saying so', async () => {
    const admin = seedAdmin({ username: 'saher', email: 'Saher@Example.com' });
    const res = await forgot('  saher@example.COM ');
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toEqual(['saher@example.com']);
    expect(mail.text).toContain('https://nhc-admin-dashboard.netlify.app/reset-password?token=');
    expect(mail.text).toContain('Your username: saher');
    const stored = fakes.Admin.byId(admin._id);
    expect(stored.resetTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.resetTokenHash).not.toBe(mailedToken()); // only the hash is stored
    expect(stored.resetTokenExpires.getTime() - Date.now()).toBeGreaterThan((RESET_MINUTES - 1) * 60_000);
    expect(audits('auth.password_reset_requested')).toHaveLength(1);
  });

  it('also finds an account whose username is the e-mail address', async () => {
    seedAdmin({ username: 'owner@example.com' });
    await forgot('owner@example.com');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('answers exactly the same for an unknown address, a malformed one and a disabled account, and sends nothing', async () => {
    seedAdmin({ username: 'gone', email: 'gone@example.com', disabled: true });
    seedAdmin({ username: 'someone', email: 'someone@example.com' }); // an account exists, so no bootstrap
    for (const email of ['nobody@example.com', 'not-an-email', 'gone@example.com', { $ne: null }, '']) {
      const res = await forgot(email);
      expect(res.status, JSON.stringify(email)).toBe(202);
      expect(res.body).toEqual({ ok: true });
    }
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('never builds a query with an operator from the request', async () => {
    seedAdmin({ username: 'x', email: 'x@example.com' });
    await forgot({ $gt: '' });
    await forgot('x@example.com');
    for (const { filter } of allFilters().filter((f) => f.name === 'Admin')) expect(sanitizeChanges(filter)).toBeNull();
  });

  it('is rate limited per address and e-mail (3 per 15 minutes)', async () => {
    seedAdmin({ username: 'r', email: 'r@example.com' });
    const ip = freshIp();
    for (let i = 0; i < 3; i += 1) expect((await forgot('r@example.com', ip)).status).toBe(202);
    expect((await forgot('r@example.com', ip)).status).toBe(429);
  });
});

describe('the first owner (no account exists yet)', () => {
  it(`creates an owner for ${OWNER_EMAIL} with an unusable password and mails the link`, async () => {
    const res = await forgot(OWNER_EMAIL);
    expect(res.status).toBe(202);
    expect(fakes.Admin.docs).toHaveLength(1);
    const owner = fakes.Admin.docs[0];
    expect(owner).toMatchObject({ username: OWNER_EMAIL, email: OWNER_EMAIL, role: 'owner' });
    expect(owner.password).toMatch(/^\$2/); // a bcrypt hash of a random value nobody knows
    expect(sendMail.mock.calls[0][0].subject).toContain('choose your password');
    expect(audits('auth.owner_bootstrap')).toHaveLength(1);

    // The owner chooses a password with the link and signs in with it.
    expect((await reset({ token: mailedToken(), password: NEW_PASSWORD })).status).toBe(204);
    expect((await login(OWNER_EMAIL, NEW_PASSWORD)).status).toBe(200);
  });

  it('creates nothing for any other address', async () => {
    await forgot('attacker@example.com');
    expect(fakes.Admin.docs).toHaveLength(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('creates nothing once any account exists (the bootstrap closes for good)', async () => {
    seedAdmin({ username: 'existing', email: 'existing@example.com' });
    await forgot(OWNER_EMAIL);
    expect(fakes.Admin.docs).toHaveLength(1);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('POST /admin/auth/reset-password', () => {
  const requested = async (overrides = {}) => {
    const admin = seedAdmin({ username: 'saher', email: 'saher@example.com', ...overrides });
    await forgot('saher@example.com');
    return { admin, token: mailedToken() };
  };

  it('sets the new password, spends the link, clears a lockout and signs out every session', async () => {
    const { admin, token } = await requested({ failedLogins: 3, lockedUntil: new Date(Date.now() + 600_000) });
    fakes.AdminSession.seed([{ sid: 's1', admin: admin._id, expiresAt: new Date(Date.now() + 3600_000), revokedAt: null }]);
    const res = await reset({ token, password: NEW_PASSWORD });
    expect(res.status).toBe(204);
    const stored = fakes.Admin.byId(admin._id);
    expect(await bcrypt.compare(NEW_PASSWORD, stored.password)).toBe(true);
    expect(stored).toMatchObject({ resetTokenHash: null, resetTokenExpires: null, failedLogins: 0, lockedUntil: null });
    expect(fakes.AdminSession.docs[0].revokedAt).toBeInstanceOf(Date);
    expect(audits('auth.password_reset')).toHaveLength(1);
    expect(JSON.stringify(fakes.AuditLog.docs)).not.toContain(NEW_PASSWORD);
    expect((await login('saher', PASSWORD)).status).toBe(401);
    expect((await login('saher', NEW_PASSWORD)).status).toBe(200);
  });

  it('a link works once', async () => {
    const { token } = await requested();
    expect((await reset({ token, password: NEW_PASSWORD })).status).toBe(204);
    const again = await reset({ token, password: 'another long password 9' });
    expect(again.status).toBe(400);
    expect(again.body.error).toMatch(/invalid or has expired/);
  });

  it('a newer request replaces the older link', async () => {
    const { token: first } = await requested();
    await forgot('saher@example.com');
    expect((await reset({ token: first, password: NEW_PASSWORD })).status).toBe(400);
    expect((await reset({ token: mailedToken(1), password: NEW_PASSWORD })).status).toBe(204);
  });

  it(`refuses a link older than ${RESET_MINUTES} minutes`, async () => {
    const { admin, token } = await requested();
    fakes.Admin.byId(admin._id).resetTokenExpires = new Date(Date.now() - 1000);
    expect((await reset({ token, password: NEW_PASSWORD })).status).toBe(400);
  });

  it('refuses a disabled account, a malformed token and a missing password', async () => {
    const { admin, token } = await requested();
    for (const body of [{ token: 'short', password: NEW_PASSWORD }, { token: { $ne: null }, password: NEW_PASSWORD }, { token }, { token, password: 'x'.repeat(201) }]) {
      expect((await reset(body)).status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
    fakes.Admin.byId(admin._id).disabled = true;
    expect((await reset({ token, password: NEW_PASSWORD })).status).toBe(400);
  });

  it('applies the password policy (and keeps the link usable after a refused password)', async () => {
    const { token } = await requested();
    const weak = await reset({ token, password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error).not.toMatch(/expired/);
    expect((await reset({ token, password: NEW_PASSWORD })).status).toBe(204);
  });

  it('keeps two-factor sign-in on', async () => {
    const { admin, token } = await requested({ totpEnabled: true });
    await reset({ token, password: NEW_PASSWORD });
    expect(fakes.Admin.byId(admin._id).totpEnabled).toBe(true);
  });
});

describe('signing in with the e-mail address', () => {
  it('accepts the account e-mail (any case) as well as the username, with the same single error otherwise', async () => {
    seedAdmin({ username: 'saher', email: 'Saher@Example.com' });
    expect((await login('saher', PASSWORD)).status).toBe(200);
    expect((await login('SAHER@example.com', PASSWORD)).status).toBe(200);
    expect((await login('saher@example.com', 'wrong password here')).status).toBe(401);
    expect((await login('other@example.com', PASSWORD)).status).toBe(401);
    expect((await login('sa.er@example.com', PASSWORD)).status).toBe(401); // the dot is not a wildcard
    for (const { filter } of allFilters().filter((f) => f.name === 'Admin')) expect(sanitizeChanges(filter)).toBeNull();
  });
});

describe('a slow or failing mail server', () => {
  it('does not delay the answer, and a failed mail is audited', async () => {
    seedAdmin({ username: 'slow', email: 'slow@example.com' });
    let finish;
    sendMail.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const started = Date.now();
    const res = await forgot('slow@example.com');
    expect(res.status).toBe(202);
    expect(Date.now() - started).toBeLessThan(2000);
    finish(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(audits('auth.password_reset_mail_failed')).toHaveLength(1);
  });
});
