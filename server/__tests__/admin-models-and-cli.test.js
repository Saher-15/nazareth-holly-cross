import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

// The real Mongoose schemas (no database needed to inspect them) and the create-admin script.

const Admin = (await import('../model/admin.js')).default;
const AuditLog = (await import('../model/auditLog.js')).default;
const AdminSession = (await import('../model/adminSession.js')).default;
const { createOwner, invocationProblem, USERNAME } = await import('../scripts/create-admin.js');
const { checkPasswordPolicy } = await import('../services/passwordPolicy.js');
const { hashPassword } = await import('../services/adminAuth.js');

const serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

describe('Admin model', () => {
  it('gives a document that predates roles the owner defaults (old admins stay valid)', () => {
    const old = new Admin({ username: 'old', password: 'hash' });
    expect(old.validateSync()).toBeUndefined();
    expect(old.toObject()).toMatchObject({ role: 'owner', disabled: false, failedLogins: 0, lockedUntil: null, totpEnabled: false, lastLoginAt: null, totpLastStep: -1 });
  });

  it('accepts the three roles and nothing else', () => {
    for (const role of ['owner', 'editor', 'viewer']) expect(new Admin({ username: 'a', password: 'p', role }).validateSync()).toBeUndefined();
    for (const role of ['admin', 'root', '', 'OWNER']) expect(new Admin({ username: 'a', password: 'p', role }).validateSync()?.errors.role, role).toBeTruthy();
  });

  it('never selects the encrypted TOTP secret unless asked', () => {
    expect(Admin.schema.path('totpSecretEnc').options.select).toBe(false);
    expect(Object.keys(Admin.schema.paths)).toEqual(expect.arrayContaining(['role', 'disabled', 'failedLogins', 'lockedUntil', 'totpSecretEnc', 'totpEnabled', 'lastLoginAt']));
  });

  it('keeps the unique username index', () => {
    expect(Admin.schema.indexes().some(([fields, options]) => fields.username === 1 && options.unique)).toBe(true);
  });

  describe('save hook', () => {
    const hook = Admin.schema.s.hooks._pres.get('save').map((h) => h.fn).find((fn) => String(fn).includes('passwordHashed'));

    it('hashes a plain password with bcrypt cost 12', async () => {
      expect(hook).toBeTypeOf('function');
      const doc = new Admin({ username: 'a', password: 'plain password 123' });
      await hook.call(doc);
      expect(bcrypt.getRounds(doc.password)).toBe(12);
      expect(await bcrypt.compare('plain password 123', doc.password)).toBe(true);
    });

    it('leaves a password alone when the caller already hashed it', async () => {
      const hash = await hashPassword('plain password 123');
      const doc = new Admin({ username: 'a', password: hash });
      doc.$locals.passwordHashed = true;
      await hook.call(doc);
      expect(doc.password).toBe(hash);
    });
  });
});

describe('AuditLog model', () => {
  it('expires entries after 180 days (TTL index)', () => {
    const ttl = AuditLog.schema.indexes().find(([, options]) => options.expireAfterSeconds !== undefined);
    expect(ttl[0]).toEqual({ at: 1 });
    expect(ttl[1].expireAfterSeconds).toBe(180 * 24 * 60 * 60);
  });

  it('is indexed for the audit screen (time, actor, action)', () => {
    const keys = AuditLog.schema.indexes().map(([fields]) => Object.keys(fields).join(','));
    expect(keys).toEqual(expect.arrayContaining(['at', 'actorName,at', 'action,at']));
  });

  it('stores who, what, when, target, address hash and browser summary', () => {
    expect(Object.keys(AuditLog.schema.paths)).toEqual(expect.arrayContaining(['at', 'actorName', 'role', 'action', 'target.type', 'target.id', 'meta', 'ipHash', 'ua']));
    expect(new AuditLog({}).validateSync().errors.action).toBeTruthy(); // an action is required
  });
});

describe('AdminSession model', () => {
  it('has a unique session id and removes sessions when they expire', () => {
    const indexes = AdminSession.schema.indexes();
    expect(indexes.some(([fields, options]) => fields.sid === 1 && options.unique)).toBe(true);
    expect(indexes.find(([fields]) => fields.expiresAt === 1)[1].expireAfterSeconds).toBe(0);
  });
});

describe('create-admin script: the conversation', () => {
  const run = async ({ answers, secrets, existing = null, hash = (p) => `hash:${p}` }) => {
    const created = [];
    class FakeAdmin {
      constructor(data) { Object.assign(this, data); this.$locals = {}; }
      async save() { created.push(this); }
      static async findOne(filter) { return existing && filter.username === existing ? { username: existing } : null; }
    }
    const log = [];
    const prompts = [];
    const outcome = await createOwner({
      ask: async (p) => { prompts.push(p); return answers.shift(); },
      askHidden: async (p) => { prompts.push(p); return secrets.shift(); },
      Admin: FakeAdmin,
      hash: async (p) => hash(p),
      checkPassword: checkPasswordPolicy,
      log: (line) => log.push(line),
    }).then((r) => ({ ok: r }), (error) => ({ error }));
    return { outcome, created, log, prompts };
  };

  it('creates an owner with a hashed password and says nothing secret', async () => {
    const { outcome, created, log } = await run({ answers: ['saher.admin'], secrets: ['a long unusual passphrase', 'a long unusual passphrase'] });
    expect(outcome.ok).toEqual({ username: 'saher.admin' });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ username: 'saher.admin', role: 'owner', password: 'hash:a long unusual passphrase' });
    expect(created[0].$locals.passwordHashed).toBe(true); // the model must not hash it again
    expect(log.join('\n')).toContain('Owner "saher.admin" created');
    expect(log.join('\n')).not.toContain('passphrase');
  });

  it('uses bcrypt cost 12 for the real hash', async () => {
    const hash = await hashPassword('a long unusual passphrase');
    expect(bcrypt.getRounds(hash)).toBe(12);
  });

  it('refuses weak passwords, three times, and creates nothing', async () => {
    const { outcome, created, log } = await run({ answers: ['saher.admin'], secrets: ['short', 'password1234', 'saher.admin.x'] });
    expect(outcome.error.message).toMatch(/No acceptable password/);
    expect(created).toHaveLength(0);
    expect(log.filter((l) => l.startsWith('Refused'))).toHaveLength(3);
    expect(log.join('\n')).toMatch(/at least 12 characters/);
    expect(log.join('\n')).toMatch(/too common/);
  });

  it('lets a person correct a weak password or a typo on the repeat', async () => {
    const { outcome, created } = await run({ answers: ['saher.admin'], secrets: ['short', 'a long unusual passphrase', 'a long unusual passphras', 'a long unusual passphrase', 'a long unusual passphrase'] });
    expect(outcome.ok).toBeTruthy();
    expect(created[0].password).toBe('hash:a long unusual passphrase');
  });

  it('refuses a username that exists and one that is not allowed, before asking for a password', async () => {
    const exists = await run({ answers: ['taken'], secrets: [], existing: 'taken' });
    expect(exists.outcome.error.message).toMatch(/already exists/);
    expect(exists.prompts.some((p) => /Password/.test(p))).toBe(false);
    for (const bad of ['', 'ab', 'two words', '<x>', '-start', 'a'.repeat(65)]) {
      const r = await run({ answers: [bad], secrets: [] });
      expect(r.outcome.error?.message, bad).toMatch(/not allowed/);
    }
    expect(USERNAME.test('saher.admin-01_x')).toBe(true);
  });
});

describe('create-admin script: how it is started', () => {
  it('refuses any argument (credentials are never taken from the command line)', () => {
    expect(invocationProblem({ argv: ['node', 'create-admin.js', 'saher', 'hunter2'], stdin: { isTTY: true }, stdout: { isTTY: true } })).toMatch(/no arguments/);
  });

  it('refuses without a terminal (a pipe, a CI job, a redirect)', () => {
    expect(invocationProblem({ argv: ['node', 'x'], stdin: { isTTY: false }, stdout: { isTTY: true } })).toMatch(/interactive terminal/);
    expect(invocationProblem({ argv: ['node', 'x'], stdin: { isTTY: true }, stdout: { isTTY: false } })).toMatch(/interactive terminal/);
    expect(invocationProblem({ argv: ['node', 'x'], stdin: { isTTY: true }, stdout: { isTTY: true } })).toBeNull();
  });

  const start = (args, input = '') => spawnSync(process.execPath, ['scripts/create-admin.js', ...args], {
    cwd: serverDir,
    input,
    encoding: 'utf8',
    timeout: 15_000,
    // Even with credentials in the environment the script must not read them, and must not reach any database.
    env: { ...process.env, DATABASEURL: 'mongodb://127.0.0.1:1/never', ADMIN_USERNAME: 'envuser', ADMIN_PASSWORD_NEW: 'envpass-envpass-1' },
  });

  it('exits with an error when run with arguments, without echoing them', () => {
    const run = start(['saher', 'hunter2-hunter2']);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/takes no arguments/);
    expect(run.stdout + run.stderr).not.toContain('hunter2');
  });

  it('exits with an error when stdin is not a terminal, even if answers are piped in', () => {
    const run = start([], 'saher\nlong-enough-password-1\nlong-enough-password-1\n');
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/interactive terminal/);
    expect(run.stdout).not.toMatch(/Database:/); // it never got as far as connecting
  });

  it('has an npm script', async () => {
    const pkg = (await import('node:fs')).default.readFileSync(path.join(serverDir, 'package.json'), 'utf8');
    expect(JSON.parse(pkg).scripts['create-admin']).toBe('node scripts/create-admin.js');
  });
});
