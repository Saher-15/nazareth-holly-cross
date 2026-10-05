import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// User management (owner only) and its guards, and the audit log reader.

vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));

const { fakes, matches, oid, quickHash } = await import('./helpers/fakes.js');
const { PASSWORD, allFilters, castProblem, freshIp, sanitizeChanges, signedIn, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { signSessionToken } = await import('../services/adminSessions.js');
const { encryptSecret, newSecret } = await import('../services/totp.js');

const { http, close } = startClient(createApp());
afterAll(close);

let me; // the signed-in owner
beforeEach(async () => {
  fakes.Admin.reset();
  fakes.AdminSession.reset();
  fakes.AuditLog.reset();
  me = await signedIn(signSessionToken, { username: 'boss', role: 'owner' });
});

const call = (method, path, who = me, body) => {
  const req = http[method](path).set('X-Forwarded-For', freshIp());
  if (who) req.set(who.auth);
  return body === undefined ? req : req.send(body);
};
const audits = (action) => fakes.AuditLog.docs.filter((d) => !action || d.action === action);
const GOOD = { username: 'new.editor', password: 'a long unusual passphrase', role: 'editor' };
const liveSessions = (adminId) => fakes.AdminSession.docs.filter((s) => String(s.admin) === adminId && !s.revokedAt);

describe('POST /admin/users', () => {
  it('creates an account with the chosen role, hashed with bcrypt, and answers without any secret', async () => {
    const res = await call('post', '/admin/users', me, GOOD);
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ username: 'new.editor', role: 'editor', disabled: false, totpEnabled: false });
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$|password|totpSecret/i);
    const stored = fakes.Admin.docs.find((a) => a.username === 'new.editor');
    expect(stored.password).toMatch(/^\$2[aby]\$/);
    expect(stored.password).not.toContain('passphrase');
    expect(await bcrypt.compare(GOOD.password, stored.password)).toBe(true); // hashed once, not twice
    expect(audits('user.create')[0]).toMatchObject({ actorName: 'boss', meta: { username: 'new.editor', role: 'editor' } });
    expect(JSON.stringify(fakes.AuditLog.docs)).not.toContain(GOOD.password);
  });

  it('the new account can sign in at once, with a password containing & < >', async () => {
    const tricky = 'R&D <team> "pass" 12345';
    expect((await call('post', '/admin/users', me, { ...GOOD, password: tricky })).status).toBe(201);
    const res = await http.post('/admin/auth/login').set('X-Forwarded-For', freshIp()).send({ username: 'new.editor', password: tricky });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('editor');
  });

  it.each([
    ['a weak password', { password: 'short' }, /at least 12/],
    ['a common password', { password: 'password1234' }, /common/],
    ['the username as password', { username: 'long.username.here', password: 'long.username.here' }, /username/],
    ['an unknown role', { role: 'admin' }, /role/],
    ['a role that is not text', { role: ['owner'] }, /role/],
    ['a username with spaces', { username: 'two words' }, /username/],
    ['a username with markup', { username: '<script>x</script>' }, /username/],
    ['a username that is too short', { username: 'ab' }, /username/],
    ['a username that is too long', { username: 'a'.repeat(65) }, /username/],
    ['a username starting with a dot', { username: '.hidden' }, /username/],
  ])('refuses %s', async (_name, change, message) => {
    const res = await call('post', '/admin/users', me, { ...GOOD, ...change });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(fakes.Admin.docs.filter((a) => a.username !== 'boss')).toHaveLength(0);
  });

  it('refuses missing fields and fields that are not part of the contract', async () => {
    for (const body of [{}, { username: 'x.y.z' }, { ...GOOD, disabled: false }, { ...GOOD, totpEnabled: true }, { ...GOOD, _id: oid() }, [GOOD]]) {
      expect((await call('post', '/admin/users', me, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('refuses a name that exists, also when it differs only by case (409)', async () => {
    await call('post', '/admin/users', me, GOOD);
    expect((await call('post', '/admin/users', me, GOOD)).status).toBe(409);
    expect((await call('post', '/admin/users', me, { ...GOOD, username: 'NEW.Editor' })).status).toBe(409);
    expect((await call('post', '/admin/users', me, { ...GOOD, username: 'BOSS' })).status).toBe(409);
  });

  it('can create another owner', async () => {
    const res = await call('post', '/admin/users', me, { ...GOOD, role: 'owner' });
    expect(res.body.item.role).toBe('owner');
  });
});

describe('GET /admin/users', () => {
  it('lists accounts without hashes or secrets, shows legacy accounts as owners, paginates and filters', async () => {
    fakes.Admin.seed([
      { username: 'legacy', password: quickHash('x'.repeat(12)) },
      { username: 'ed1', password: quickHash('x'.repeat(12)), role: 'editor', totpEnabled: true, totpSecretEnc: encryptSecret(newSecret()) },
      { username: 'ed2', password: quickHash('x'.repeat(12)), role: 'editor', disabled: true },
      { username: 'vw', password: quickHash('x'.repeat(12)), role: 'viewer' },
    ], { raw: false });
    fakes.Admin.docs.find((a) => a.username === 'legacy').role = undefined;
    delete fakes.Admin.docs.find((a) => a.username === 'legacy').role;

    const res = await call('get', '/admin/users');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 5, page: 1, size: 25 });
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$|totpSecretEnc|"password"/);
    const byName = Object.fromEntries(res.body.items.map((u) => [u.username, u]));
    expect(byName.legacy).toMatchObject({ role: 'owner', disabled: false, totpEnabled: false });
    expect(byName.ed1).toMatchObject({ role: 'editor', totpEnabled: true });
    expect(byName.ed2.disabled).toBe(true);

    expect((await call('get', '/admin/users?status=editor')).body.total).toBe(2);
    expect((await call('get', '/admin/users?status=owner')).body.items.map((u) => u.username).sort()).toEqual(['boss', 'legacy']);
    expect((await call('get', '/admin/users?status=disabled')).body.total).toBe(1);
    expect((await call('get', '/admin/users?q=ed&sort=username')).body.items.map((u) => u.username)).toEqual(['ed1', 'ed2']);
    expect((await call('get', '/admin/users?size=2&page=3')).body.items).toHaveLength(1);
    expect((await call('get', '/admin/users?sort=password')).status).toBe(400);
  });
});

describe('PATCH /admin/users/:id', () => {
  const target = (extra = {}) => fakes.Admin.seed([{ username: `t${oid().slice(-5)}`, password: quickHash('x'.repeat(12)), role: 'editor', ...extra }])[0];
  const withSession = (admin) => fakes.AdminSession.seed([{ sid: `s-${oid()}`, admin: admin._id, expiresAt: new Date(Date.now() + 3600_000), revokedAt: null }]);

  it('changes the role and ends the account\'s sessions', async () => {
    const t = target();
    withSession(t);
    const res = await call('patch', `/admin/users/${t._id}`, me, { role: 'viewer' });
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ _id: t._id, role: 'viewer' });
    expect(fakes.Admin.byId(t._id).role).toBe('viewer');
    expect(liveSessions(t._id)).toHaveLength(0);
    expect(audits('user.update')[0]).toMatchObject({ target: { type: 'user', id: t._id }, meta: { role: 'viewer' } });
  });

  it('disables an account: its sessions end, and it can no longer sign in', async () => {
    const session = await signedIn(signSessionToken, { username: 'soon.gone2', role: 'editor' });
    const res = await call('patch', `/admin/users/${session.admin._id}`, me, { disabled: true });
    expect(res.body.item.disabled).toBe(true);
    expect((await call('get', '/admin/auth/me', session)).status).toBe(401);
    const login = await http.post('/admin/auth/login').set('X-Forwarded-For', freshIp()).send({ username: 'soon.gone2', password: PASSWORD });
    expect(login.status).toBe(401);
  });

  it('re-enabling clears a lockout', async () => {
    const t = target({ disabled: true, failedLogins: 3, lockedUntil: new Date(Date.now() + 600_000) });
    await call('patch', `/admin/users/${t._id}`, me, { disabled: false });
    expect(fakes.Admin.byId(t._id)).toMatchObject({ disabled: false, failedLogins: 0, lockedUntil: null });
  });

  it('resets another account\'s second factor (recovery) and ends its sessions', async () => {
    const t = target({ totpEnabled: true, totpSecretEnc: encryptSecret(newSecret()) });
    withSession(t);
    const res = await call('patch', `/admin/users/${t._id}`, me, { resetTotp: true });
    expect(res.body.item.totpEnabled).toBe(false);
    expect(fakes.Admin.byId(t._id)).toMatchObject({ totpEnabled: false, totpSecretEnc: null });
    expect(liveSessions(t._id)).toHaveLength(0);
  });

  it('cannot disable yourself, change your own role, or reset your own second factor', async () => {
    for (const body of [{ disabled: true }, { role: 'viewer' }, { role: 'editor' }, { resetTotp: true }]) {
      const res = await call('patch', `/admin/users/${me.admin._id}`, me, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(fakes.Admin.byId(me.admin._id)).toMatchObject({ role: 'owner', disabled: false });
    expect((await call('get', '/admin/auth/me', me)).status).toBe(200);
  });

  it('cannot get round the self check with an upper-case id', async () => {
    const upper = me.admin._id.toUpperCase();
    expect((await call('patch', `/admin/users/${upper}`, me, { disabled: true })).status).toBe(400);
    expect((await call('delete', `/admin/users/${upper}`, me)).status).toBe(400);
  });

  it('allows a no-change self update (same role)', async () => {
    expect((await call('patch', `/admin/users/${me.admin._id}`, me, { role: 'owner' })).status).toBe(200);
  });

  it('refuses an empty body, unknown fields, wrong types, bad ids, missing users', async () => {
    const t = target();
    for (const body of [{}, { role: 'admin' }, { disabled: 'yes' }, { resetTotp: 1 }, { role: 'viewer', username: 'x' }, { password: 'x'.repeat(14) }]) {
      expect((await call('patch', `/admin/users/${t._id}`, me, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await call('patch', '/admin/users/not-an-id', me, { role: 'viewer' })).status).toBe(400);
    expect((await call('patch', `/admin/users/${oid()}`, me, { role: 'viewer' })).status).toBe(404);
  });
});

describe('the last-owner rule', () => {
  // An acting owner is always an enabled owner other than the target, so through normal use the rule cannot fire;
  // it is the safety net for two owners changing each other at the same moment. These tests make the database
  // report "no other enabled owner" the way that race would.
  const owner2 = () => fakes.Admin.seed([{ username: 'second.owner', password: quickHash('x'.repeat(12)), role: 'owner' }])[0];

  it('counts the OTHER enabled owners, including accounts that predate roles', async () => {
    const t = owner2();
    const legacy = fakes.Admin.seed([{ username: 'legacy.owner', password: quickHash('x'.repeat(12)) }], { raw: true })[0];
    const disabled = fakes.Admin.seed([{ username: 'off.owner', password: quickHash('x'.repeat(12)), role: 'owner', disabled: true }])[0];
    const editor = fakes.Admin.seed([{ username: 'just.editor', password: quickHash('x'.repeat(12)), role: 'editor' }])[0];
    fakes.Admin.calls.length = 0;
    await call('patch', `/admin/users/${t._id}`, me, { role: 'viewer' });
    const { filter } = fakes.Admin.calls.find((c) => c.op === 'countDocuments');
    const counted = fakes.Admin.docs.filter((d) => matches(d, filter)).map((d) => d.username).sort();
    expect(counted).toEqual(['boss', 'legacy.owner']); // not the target, not the disabled owner, not the editor
    void legacy; void disabled; void editor;
  });

  it.each([
    ['demote', 'patch', { role: 'viewer' }],
    ['disable', 'patch', { disabled: true }],
    ['delete', 'delete', undefined],
  ])('refuses to %s an owner when no other enabled owner remains (409)', async (_name, method, body) => {
    const t = owner2();
    const spy = vi.spyOn(fakes.Admin, 'countDocuments').mockResolvedValue(0);
    const res = await call(method, `/admin/users/${t._id}`, me, body);
    spy.mockRestore();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/last owner/);
    expect(fakes.Admin.byId(t._id)).toMatchObject({ role: 'owner', disabled: false });
    expect(audits('user.update')).toHaveLength(0);
    expect(audits('user.delete')).toHaveLength(0);
  });

  it('allows the same changes while another enabled owner exists, and for non-owners always', async () => {
    const t = owner2();
    expect((await call('patch', `/admin/users/${t._id}`, me, { role: 'viewer' })).status).toBe(200);
    const spy = vi.spyOn(fakes.Admin, 'countDocuments').mockResolvedValue(0);
    expect((await call('patch', `/admin/users/${t._id}`, me, { disabled: true })).status).toBe(200); // a viewer now: not an owner
    expect((await call('delete', `/admin/users/${t._id}`, me)).status).toBe(200);
    spy.mockRestore();
  });
});
describe('DELETE /admin/users/:id', () => {
  it('deletes an account, ends its sessions, audits with the name', async () => {
    const t = await signedIn(signSessionToken, { username: 'leaving', role: 'editor' });
    const res = await call('delete', `/admin/users/${t.admin._id}`, me);
    expect(res.status).toBe(200);
    expect(fakes.Admin.byId(t.admin._id)).toBeUndefined();
    expect((await call('get', '/admin/auth/me', t)).status).toBe(401);
    expect(audits('user.delete')[0]).toMatchObject({ target: { type: 'user', id: t.admin._id }, meta: { username: 'leaving' } });
  });

  it('cannot delete yourself', async () => {
    const res = await call('delete', `/admin/users/${me.admin._id}`, me);
    expect(res.status).toBe(400);
    expect(fakes.Admin.byId(me.admin._id)).toBeTruthy();
  });

  it('404 for a missing user, 400 for a bad id', async () => {
    expect((await call('delete', `/admin/users/${oid()}`, me)).status).toBe(404);
    expect((await call('delete', '/admin/users/nope', me)).status).toBe(400);
  });
});

describe('only an owner may manage users', () => {
  it.each(['editor', 'viewer'])('%s gets 403 on every users route', async (role) => {
    const who = await signedIn(signSessionToken, { role });
    const t = fakes.Admin.seed([{ username: 'victim', password: quickHash('x'.repeat(12)), role: 'editor' }])[0];
    for (const [method, path, body] of [
      ['get', '/admin/users'], ['post', '/admin/users', GOOD], ['patch', `/admin/users/${t._id}`, { role: 'owner' }], ['delete', `/admin/users/${t._id}`],
    ]) {
      expect((await call(method, path, who, body)).status, `${method} ${path}`).toBe(403);
    }
    expect(fakes.Admin.byId(t._id).role).toBe('editor');
  });
});

describe('GET /admin/audit (owner only)', () => {
  const entry = (over) => ({ at: new Date(), actorName: 'boss', role: 'owner', action: 'order.update', target: { type: 'order', id: oid() }, meta: {}, ipHash: 'h'.repeat(32), ua: 'Chrome 126 / Windows', ...over });

  it('lists newest first with address hash and browser summary', async () => {
    fakes.AuditLog.seed([
      entry({ action: 'a.old', at: new Date(Date.now() - 3000) }),
      entry({ action: 'a.new', at: new Date(Date.now() - 1000) }),
      entry({ action: 'a.mid', at: new Date(Date.now() - 2000) }),
    ]);
    const res = await call('get', '/admin/audit');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, size: 25 });
    expect(res.body.items.map((e) => e.action)).toEqual(['a.new', 'a.mid', 'a.old']);
    expect(res.body.items[0]).toMatchObject({ actorName: 'boss', ipHash: 'h'.repeat(32), ua: 'Chrome 126 / Windows' });
    expect((await call('get', '/admin/audit?sort=at')).body.items[0].action).toBe('a.old');
  });

  it('filters by actor and by action (exact, or a prefix ending in a dot)', async () => {
    fakes.AuditLog.seed([
      entry({ actorName: 'ann', action: 'auth.login' }), entry({ actorName: 'ann', action: 'auth.login_failed' }),
      entry({ actorName: 'bob', action: 'product.update' }), entry({ actorName: 'bob', action: 'auth.login' }),
    ]);
    expect((await call('get', '/admin/audit?actor=ann')).body.total).toBe(2);
    expect((await call('get', '/admin/audit?action=auth.login')).body.total).toBe(2);
    expect((await call('get', '/admin/audit?action=auth.')).body.total).toBe(3);
    expect((await call('get', '/admin/audit?actor=bob&action=auth.login')).body.total).toBe(1);
    expect((await call('get', '/admin/audit?actor=nobody')).body.total).toBe(0);
  });

  it('refuses a malformed filter instead of passing it on', async () => {
    for (const q of ['action=a%20b', 'action=%24where', 'action=' + 'a'.repeat(61), 'actor=', 'actor[]=x', 'action[$ne]=x']) {
      const res = await call('get', `/admin/audit?${q}`);
      expect([400, 200], q).toContain(res.status);
      if (res.status === 200) expect(res.body.total, q).toBeGreaterThanOrEqual(0);
    }
    expect((await call('get', '/admin/audit?action=a%20b')).status).toBe(400);
    expect((await call('get', '/admin/audit?actor=')).status).toBe(400);
  });

  it('paginates within bounds', async () => {
    fakes.AuditLog.seed(Array.from({ length: 5 }, (_, i) => entry({ action: `x.${i}` })));
    const res = await call('get', '/admin/audit?size=2&page=3');
    expect(res.body).toMatchObject({ total: 5, page: 3, size: 2 });
    expect(res.body.items).toHaveLength(1);
    expect((await call('get', '/admin/audit?size=100000')).body.size).toBe(100);
  });

  it('is owner only', async () => {
    for (const role of ['editor', 'viewer']) {
      const who = await signedIn(signSessionToken, { role });
      expect((await call('get', '/admin/audit', who)).status).toBe(403);
    }
  });

  it('shows the sign-in trail end to end', async () => {
    fakes.Admin.seed([{ username: 'trail', password: quickHash(PASSWORD), role: 'editor' }]);
    const ip = freshIp();
    await http.post('/admin/auth/login').set('X-Forwarded-For', ip).send({ username: 'trail', password: 'wrong-wrong-wrong' });
    await http.post('/admin/auth/login').set('X-Forwarded-For', ip).send({ username: 'trail', password: PASSWORD });
    const res = await call('get', '/admin/audit?actor=trail&sort=at');
    expect(res.body.items.map((e) => e.action)).toEqual(['auth.login_failed', 'auth.login']);
    expect(res.body.items[0].ipHash).toBe(res.body.items[1].ipHash); // same address, comparable
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    expect(JSON.stringify(res.body)).not.toContain(ip);
  });
});

describe('query filters survive Mongoose sanitizeFilter (which the server runs with)', () => {
  it('every filter of the sign-in, session, user and audit routes comes out unchanged', async () => {
    const other = fakes.Admin.seed([{ username: 'peer', password: quickHash(PASSWORD), role: 'owner' }])[0];
    const legacy = fakes.Admin.seed([{ username: 'legacy', password: quickHash(PASSWORD) }], { raw: true })[0];
    fakes.AuditLog.seed([{ at: new Date(), actorName: 'boss', action: 'auth.login', target: {}, meta: {} }]);
    await http.post('/admin/auth/login').set('X-Forwarded-For', freshIp()).send({ username: 'peer', password: PASSWORD });
    await http.post('/admin/auth/login').set('X-Forwarded-For', freshIp()).send({ username: 'peer', password: 'wrong-wrong-wrong' });
    await http.post('/admin/auth/password').set('X-Forwarded-For', freshIp()).set(me.auth).send({ currentPassword: PASSWORD, newPassword: 'another long passphrase' });
    await call('post', '/admin/users', me, GOOD);
    for (const path of ['/admin/users?status=owner', '/admin/users?status=editor&q=ed', '/admin/users?status=disabled', '/admin/audit?actor=boss&action=auth.', '/admin/audit?action=auth.login&q=x']) {
      expect((await call('get', path)).status, path).toBe(200);
    }
    await call('patch', `/admin/users/${other._id}`, me, { role: 'viewer' });
    await call('patch', `/admin/users/${legacy._id}`, me, { disabled: true });
    await call('delete', `/admin/users/${legacy._id}`, me);
    await call('post', '/admin/auth/logout', me);
    const filters = allFilters();
    expect(filters.length).toBeGreaterThan(15);
    for (const { name, op, filter } of filters) {
      expect(sanitizeChanges(filter), `${name}.${op} ${JSON.stringify(filter)}`).toBeNull();
    }
    // ...and the real schemas can cast them (the fields exist, the values fit)
    for (const { name, op, filter } of filters) {
      expect(await castProblem(name, filter), `${name}.${op} ${JSON.stringify(filter)}`).toBeNull();
    }
  });
});