import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isEmail, isObjectId, isPayPalOrderId, isText, clip } from '../utils/validate.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('isEmail', () => {
  it.each([
    'maria@example.com',
    'maria.haddad+nhc@mail.example.co.il',
    "o'brien@example.org",
    'a_b-c@sub.domain.example',
    'x@y.zz',
    ' padded@example.com\n', // surrounding whitespace is trimmed by every caller
  ])('accepts %j', (value) => expect(isEmail(value)).toBe(true));

  it.each([
    'a@b.co,c@d.co',
    'a@b.co;c@d.co',
    'a@b.co c@d.co',
    'Name <a@b.co>',
    '<a@b.co>',
    '"quoted"@b.co',
    'a@b.co\r\nBcc: x@y.zz',
    'a\n@b.co',
    'a(comment)@b.co',
    'a@b@c.co',
    'a@localhost',
    'a@.co',
    'a@b..co',
    '@b.co',
    'a@-b.co',
    `${'a'.repeat(65)}@b.co`,
    `a@${'b'.repeat(250)}.co`,
    '',
    null,
    undefined,
    42,
    ['a@b.co'],
    { toString: () => 'a@b.co' },
  ])('refuses %j', (value) => expect(isEmail(value)).toBe(false));
});

describe('other checks', () => {
  it('isObjectId wants exactly 24 hex digits', () => {
    expect(isObjectId('64b000000000000000000001')).toBe(true);
    expect(isObjectId('64B0000000000000000000AA')).toBe(true);
    for (const bad of ['abcdefghijkl', '64b00000000000000000000', '64b0000000000000000000011', 'zzzzzzzzzzzzzzzzzzzzzzzz', 5, null, {}, ['64b000000000000000000001']]) {
      expect(isObjectId(bad)).toBe(false);
    }
  });

  it('isPayPalOrderId wants 17 capital letters or digits', () => {
    expect(isPayPalOrderId('ABCDEFGHIJ0123456')).toBe(true);
    for (const bad of ['abcdefghij0123456', 'ABCDEFGHIJ012345', 'ABCDEFGHIJ01234567', 'ABCDEFGHIJ0123-56', '../../etc/passwd', null, {}]) {
      expect(isPayPalOrderId(bad)).toBe(false);
    }
  });

  it('isText wants a non-blank string', () => {
    expect(isText('x')).toBe(true);
    for (const bad of ['', '   ', null, undefined, 1, {}, ['x']]) expect(isText(bad)).toBe(false);
  });

  it('clip trims and bounds text, and ignores everything else', () => {
    expect(clip('  brown  ', 50)).toBe('brown');
    expect(clip('x'.repeat(100), 10)).toHaveLength(10);
    expect(clip({}, 10)).toBeUndefined();
    expect(clip(undefined, 10)).toBeUndefined();
  });
});

describe('secretProblems', () => {
  const saved = { jwt: process.env.JWT_SECRET, pass: process.env.ADMIN_PASSWORD };
  const load = async () => {
    vi.resetModules();
    return (await import('../config/env.js')).secretProblems;
  };
  afterEach(() => {
    process.env.JWT_SECRET = saved.jwt;
    if (saved.pass === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = saved.pass;
  });

  const setAdminPassword = (value) => {
    if (value === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = value;
  };

  it('is quiet for a strong JWT_SECRET', async () => {
    process.env.JWT_SECRET = 'k'.repeat(48);
    setAdminPassword(undefined);
    expect(await (await load())()).toEqual([]);
  });

  it('treats the example value as fatal', async () => {
    process.env.JWT_SECRET = 'your-very-long-random-secret-key-here';
    setAdminPassword(undefined);
    const problems = (await (await load())());
    expect(problems.filter((p) => p.fatal)).toHaveLength(1);
  });

  it('warns (not fatal) about a short JWT_SECRET', async () => {
    process.env.JWT_SECRET = 'short-secret';
    setAdminPassword(undefined);
    const problems = (await (await load())());
    expect(problems).toHaveLength(1);
    expect(problems.every((p) => !p.fatal)).toBe(true);
  });

  // The shared-password sign-in was removed (security review 06, finding 1): the variable is no longer required and a
  // leftover value only earns a warning to delete it, never a fatal stop, whatever it is.
  it('does not require ADMIN_PASSWORD, and asks to delete a leftover one without ever stopping', async () => {
    vi.resetModules();
    const { REQUIRED_ENV } = await import('../config/env.js');
    expect(REQUIRED_ENV).not.toContain('ADMIN_PASSWORD');
    expect(REQUIRED_ENV).toContain('JWT_SECRET');
    process.env.JWT_SECRET = 'k'.repeat(48);
    for (const leftover of ['your-secure-admin-password', 'short', 'k'.repeat(48)]) {
      setAdminPassword(leftover);
      const problems = (await (await load())());
      expect(problems).toEqual([{ fatal: false, message: expect.stringMatching(/ADMIN_PASSWORD is set but no longer used/) }]);
    }
  });

  it('never puts a secret value into a message', async () => {
    process.env.JWT_SECRET = 'changeme';
    setAdminPassword('password-leftover-value');
    const text = JSON.stringify(await (await load())());
    expect(text).not.toMatch(/changeme|password-leftover-value/);
  });
});

describe('errorHandler', () => {
  let res;
  const run = (err) => {
    res = { statusCode: 0, body: null, headersSent: false, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    errorHandler(err, { method: 'POST', originalUrl: '/x' }, res, vi.fn());
    return res;
  };
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

  it('maps a duplicate-key error to 409 without the index details', () => {
    const out = run(Object.assign(new Error('E11000 duplicate key error collection: db.order index: paypalOrderId_1 dup key: { paypalOrderId: "X" }'), { code: 11000 }));
    expect(out.statusCode).toBe(409);
    expect(JSON.stringify(out.body)).not.toMatch(/E11000|index|dup key/);
  });
});
