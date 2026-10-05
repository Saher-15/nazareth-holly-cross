import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));

const { fakes } = await import('./helpers/fakes.js');
const { parseBody, str, secret, int, num, bool, oneOf, arrayOf, nullable, opt, url } = await import('../utils/schema.js');
const { checkPasswordPolicy } = await import('../services/passwordPolicy.js');
const { audit, cleanMeta, hashIp, summarizeUserAgent } = await import('../services/audit.js');
const { atLeast, isRole } = await import('../services/roles.js');
const { csvCell, toCsv } = await import('../route/admin/export.js');
const { pageParams, parseList, searchFilter, MAX_SIZE } = await import('../route/admin/common.js');
const { lastDays, zeroFill, dayKey } = await import('../services/dashboard.js');
const { hashPassword, BCRYPT_COST } = await import('../services/adminAuth.js');
const bcrypt = (await import('bcryptjs')).default;

const message = (fn) => { try { fn(); } catch (e) { return `${e.status} ${e.message}`; } return 'no error'; };

describe('parseBody (strict request validation)', () => {
  const shape = { name: str({ min: 2, max: 10 }), age: opt(int({ min: 0, max: 150 })) };

  it('returns only the fields of the shape, cleaned', () => {
    expect(parseBody({ name: '  Ana  ' }, shape)).toEqual({ name: 'Ana' });
    expect(parseBody({ name: 'Ana', age: 3 }, shape)).toEqual({ name: 'Ana', age: 3 });
  });

  it('refuses a body that is not a JSON object', () => {
    for (const body of [undefined, null, 'text', 5, [], [{ name: 'Ana' }]]) {
      expect(message(() => parseBody(body, shape)), JSON.stringify(body)).toMatch(/^400 Invalid body/);
    }
  });

  it('refuses unknown fields (no mass assignment) without echoing markup', () => {
    expect(message(() => parseBody({ name: 'Ana', role: 'owner' }, shape))).toBe('400 Unexpected field: role');
    expect(message(() => parseBody({ name: 'Ana', '<script>': 1 }, shape))).toBe('400 Unexpected field: ?script?');
    expect(message(() => parseBody(JSON.parse('{"name":"Ana","__proto__":{"x":1}}'), shape))).toMatch(/^400 Unexpected field/);
  });

  it('requires fields that are not opt()', () => {
    expect(message(() => parseBody({}, shape))).toBe('400 name is required');
  });

  it('checks the type before anything else', () => {
    for (const value of [5, true, null, {}, [], { $ne: 1 }, ['Ana']]) {
      expect(message(() => parseBody({ name: value }, shape)), JSON.stringify(value)).toBe('400 Invalid name: must be text');
    }
  });

  it('never repeats the rejected value in the message', () => {
    expect(message(() => parseBody({ name: 'x'.repeat(50) }, shape))).not.toContain('xxxx');
  });
});

describe('rules', () => {
  const run = (rule, value) => message(() => rule(value, 'f'));

  it('str: length, control characters, single line, pattern', () => {
    expect(rule(str({ min: 1, max: 3 }), ' ab ')).toBe('ab');
    expect(run(str({ min: 1, max: 3 }), '')).toMatch(/length/);
    expect(run(str({ max: 3 }), 'abcd')).toMatch(/length/);
    expect(run(str(), 'a\u0000b')).toMatch(/control/);
    expect(run(str(), 'a\nb')).toMatch(/single line/);
    expect(rule(str({ multiline: true }), 'a\nb')).toBe('a\nb');
    expect(run(str({ pattern: /^\d+$/ }), 'abc')).toMatch(/wrong format/);
  });

  it('secret: never trimmed, only bounded', () => {
    expect(rule(secret(), '  pass  ')).toBe('  pass  ');
    expect(run(secret({ max: 5 }), 'abcdef')).toMatch(/length/);
    expect(run(secret(), 5)).toMatch(/text/);
  });

  it('num / int / bool / oneOf / arrayOf / nullable', () => {
    expect(run(num({ min: 1 }), 0)).toMatch(/between/);
    expect(run(num(), NaN)).toMatch(/number/);
    expect(run(num(), Infinity)).toMatch(/number/);
    expect(run(num(), '5')).toMatch(/number/);
    expect(run(int(), 1.5)).toMatch(/whole/);
    expect(run(int({ max: 5 }), 6)).toMatch(/between/);
    expect(run(bool(), 'true')).toMatch(/true or false/);
    expect(run(oneOf(['a', 'b']), 'c')).toMatch(/one of a, b/);
    expect(run(oneOf(['a']), ['a'])).toMatch(/one of/);
    expect(run(arrayOf(str(), { max: 2 }), ['a', 'b', 'c'])).toMatch(/at most 2/);
    expect(run(arrayOf(str()), 'a')).toMatch(/list/);
    expect(run(arrayOf(int()), [1, 'x'])).toMatch(/whole/);
    expect(rule(nullable(int()), null)).toBeNull();
    expect(run(nullable(int()), 'x')).toMatch(/whole/);
  });

  it('url: http(s) only, no markup, decodes the sanitizer\'s &amp;', () => {
    expect(rule(url(), 'https://firebasestorage.example/o/a.jpg?alt=media&amp;token=abc')).toBe('https://firebasestorage.example/o/a.jpg?alt=media&token=abc');
    for (const bad of ['javascript:alert(1)', 'data:text/html,<b>', 'ftp://x.example/a', 'https://', 'https://a b.example/', 'https://x.example/"onload=1', 'https://x.example/<script>', '/relative', 5]) {
      expect(run(url(), bad), String(bad)).not.toBe('no error');
    }
    expect(run(url({ max: 20 }), `https://x.example/${'a'.repeat(30)}`)).toMatch(/length/);
  });
});
const rule = (r, v) => r(v, 'f');

describe('checkPasswordPolicy', () => {
  it('accepts a long, unusual password', () => {
    expect(checkPasswordPolicy('correct horse battery', 'saher')).toBeNull();
    expect(checkPasswordPolicy('Xk9$mQ2vLp7#', 'saher')).toBeNull();
  });

  it('refuses under 12 characters', () => {
    expect(checkPasswordPolicy('Short1!', 'saher')).toMatch(/at least 12/);
    expect(checkPasswordPolicy('12345678901', 'saher')).toMatch(/at least 12/);
  });

  it('refuses the username, in any case and with a few characters added', () => {
    expect(checkPasswordPolicy('administrator', 'Administrator')).toMatch(/username/);
    expect(checkPasswordPolicy('SAHER.ADMIN.USER', 'saher.admin.user')).toMatch(/username/);
    expect(checkPasswordPolicy('saher-admin-01', 'saher-admin')).toMatch(/username/);
  });

  it('refuses common passwords whatever the case or separators', () => {
    for (const bad of ['password1234', 'PassWord1234', 'qwerty123456', 'Pass-Word-1234', '123456789012', 'aaaaaaaaaaaa']) {
      expect(checkPasswordPolicy(bad, 'someone'), bad).toMatch(/common|repetitive/);
    }
  });

  it('refuses a non-string and an absurdly long password', () => {
    expect(checkPasswordPolicy(undefined, 'a')).toMatch(/text/);
    expect(checkPasswordPolicy('x1'.repeat(150), 'a')).toMatch(/at most/);
  });
});

describe('roles', () => {
  it('orders owner > editor > viewer and rejects anything else', () => {
    expect(atLeast('owner', 'viewer')).toBe(true);
    expect(atLeast('editor', 'editor')).toBe(true);
    expect(atLeast('viewer', 'editor')).toBe(false);
    expect(atLeast('editor', 'owner')).toBe(false);
    expect(atLeast('admin', 'viewer')).toBe(false);
    expect(atLeast(undefined, 'viewer')).toBe(false);
    expect(isRole('toString')).toBe(false); // not an inherited property
    expect(isRole('__proto__')).toBe(false);
  });
});

describe('bcrypt cost', () => {
  it('hashes new passwords with cost 12', async () => {
    expect(BCRYPT_COST).toBe(12);
    const hash = await hashPassword('correct horse battery');
    expect(bcrypt.getRounds(hash)).toBe(12);
    expect(await bcrypt.compare('correct horse battery', hash)).toBe(true);
  });
});

describe('audit helper', () => {
  beforeEach(() => fakes.AuditLog.reset());
  const req = (extra = {}) => ({ ip: '203.0.113.7', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' }, adminUser: { id: 'a'.repeat(24), username: 'saher', role: 'owner' }, ...extra });

  it('writes who, what, when, target, address hash and browser summary', async () => {
    expect(await audit(req(), 'order.update', { type: 'order', id: 'abc' }, { done: true })).toBe(true);
    const [entry] = fakes.AuditLog.docs;
    expect(entry).toMatchObject({ actorName: 'saher', role: 'owner', action: 'order.update', target: { type: 'order', id: 'abc' }, meta: { done: true }, ua: 'Chrome 126 / Windows' });
    expect(entry.at).toBeInstanceOf(Date);
    expect(entry.ipHash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(entry)).not.toContain('203.0.113.7');
  });

  it('the same address always hashes the same, another address differently', () => {
    expect(hashIp('203.0.113.7')).toBe(hashIp('203.0.113.7'));
    expect(hashIp('203.0.113.8')).not.toBe(hashIp('203.0.113.7'));
  });

  it('records the typed name of a failed sign-in (no account was proven)', async () => {
    await audit(req({ adminUser: undefined, auditActor: { username: 'ghost' } }), 'auth.login_failed', null, { reason: 'unknown_user' });
    expect(fakes.AuditLog.docs[0]).toMatchObject({ actorName: 'ghost', actorId: null, role: '', target: { type: '', id: '' } });
  });

  it('drops secret-looking keys and bounds everything else', () => {
    const meta = cleanMeta({
      password: 'x', newPassword: 'x', token: 'x', totpCode: '1', secretValue: 'x', authorization: 'x', apiKey: 'x',
      $where: 'x', 'a.b': 1, ok: 'fine', long: 'y'.repeat(500), n: 5, nan: NaN, flag: false, nothing: null,
      list: ['a', { x: 1 }, 3], nested: { deep: { deeper: 1 }, ok: 1 }, 'bad\nname': 'v',
    });
    expect(Object.keys(meta).sort()).toEqual(['bad name', 'flag', 'list', 'long', 'n', 'nan', 'nested', 'nothing', 'ok']);
    expect(meta.long).toHaveLength(200);
    expect(meta.nan).toBeNull();
    expect(meta.list).toEqual(['a', null, 3]);
    expect(meta.nested).toEqual({ ok: 1 });
  });

  it('never throws and never fails the request when the log cannot be written', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = fakes.AuditLog.create;
    fakes.AuditLog.create = () => Promise.reject(new Error('disk full'));
    expect(await audit(req(), 'order.delete', 'order:1')).toBe(false);
    expect(err.mock.calls[0][0]).toContain('audit write failed (order.delete): disk full');
    fakes.AuditLog.create = original;
    err.mockRestore();
  });

  it('accepts a "type:id" string target', async () => {
    await audit(req(), 'x.y', 'order:64b000000000000000000001');
    expect(fakes.AuditLog.docs[0].target).toEqual({ type: 'order', id: '64b000000000000000000001' });
  });

  it('summarises user agents', () => {
    expect(summarizeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')).toBe('Safari 17 / iOS');
    expect(summarizeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0')).toBe('Edge 126 / Windows');
    expect(summarizeUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0')).toBe('Firefox 127 / Linux');
    expect(summarizeUserAgent('curl/8.5.0')).toBe('curl 8');
    expect(summarizeUserAgent(undefined)).toBe('Unknown');
    expect(summarizeUserAgent('x'.repeat(500)).length).toBeLessThanOrEqual(80);
  });
});

describe('CSV cells (formula injection)', () => {
  it.each([
    ['=1+1', "'=1+1"], ['+49 123', "'+49 123"], ['-2+3', "'-2+3"], ['@SUM(A1)', "'@SUM(A1)"], ['\tcmd', "'\tcmd"], ['\rcmd', `"'\rcmd"`],
    ['=HYPERLINK("http://evil","x")', `"'=HYPERLINK(""http://evil"",""x"")"`],
  ])('%j -> %j', (input, output) => {
    expect(csvCell(input)).toBe(output);
  });

  it('leaves safe text alone and quotes commas, quotes and line breaks', () => {
    expect(csvCell('Anna')).toBe('Anna');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('שלום')).toBe('שלום');
  });

  it('writes numbers and booleans as they are (they cannot start a formula), dates as ISO text', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(false)).toBe('false');
    expect(csvCell(new Date('2026-10-06T10:00:00Z'))).toBe('2026-10-06T10:00:00.000Z');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('decodes the HTML entities the API stores before checking, so "&amp;" shows as "&"', () => {
    expect(csvCell('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(csvCell('&#39;=x')).toBe("'=x"); // decodes to a leading quote, which already keeps it text
  });

  it('builds rows with a BOM, a header and CRLF', () => {
    const csv = toCsv([{ header: 'name', value: (r) => r.n }, { header: 'total', value: (r) => r.t }], [{ n: '=x', t: 3 }, { n: 'b', t: -1 }]);
    expect(csv).toBe("﻿name,total\r\n'=x,3\r\nb,-1\r\n");
  });
});

describe('pagination and list parsing', () => {
  it('clamps page and size, and falls back for junk', () => {
    expect(pageParams({})).toEqual({ page: 1, size: 25, skip: 0 });
    expect(pageParams({ page: '3', size: '10' })).toEqual({ page: 3, size: 10, skip: 20 });
    expect(pageParams({ page: '0', size: '0' })).toEqual({ page: 1, size: 1, skip: 0 });
    expect(pageParams({ page: '-4', size: '-7' })).toEqual({ page: 1, size: 1, skip: 0 });
    expect(pageParams({ page: '999999999', size: '5000' })).toEqual({ page: 10000, size: MAX_SIZE, skip: 9999 * MAX_SIZE });
    expect(pageParams({ page: 'abc', size: '1e9' })).toEqual({ page: 1, size: 1, skip: 0 });
    expect(pageParams({ page: ['2'], size: { a: 1 } })).toEqual({ page: 1, size: 25, skip: 0 });
    expect(pageParams({ page: '2.9', size: ' 7 ' })).toEqual({ page: 2, size: 7, skip: 7 });
  });

  const options = { searchFields: ['name'], statuses: { open: { done: false } }, sorts: { createdAt: true, name: true } };

  it('accepts only whitelisted sorts and statuses', () => {
    expect(parseList({ sort: 'name' }, options).sort).toEqual({ name: 1, _id: -1 });
    expect(parseList({ sort: '-name' }, options).sort).toEqual({ name: -1, _id: -1 });
    expect(parseList({}, options).sort).toEqual({ createdAt: -1, _id: -1 });
    expect(message(() => parseList({ sort: 'password' }, options))).toMatch(/^400 Invalid sort/);
    expect(message(() => parseList({ sort: '$where' }, options))).toMatch(/^400 Invalid sort/);
    expect(message(() => parseList({ sort: 'constructor' }, options))).toMatch(/^400 Invalid sort/);
    expect(parseList({ status: 'open' }, options).filter).toEqual({ done: false });
    expect(parseList({ status: 'all' }, options).filter).toEqual({});
    expect(message(() => parseList({ status: 'nope' }, options))).toMatch(/^400 Invalid status/);
    expect(message(() => parseList({ status: '__proto__' }, options))).toMatch(/^400 Invalid status/);
  });

  it('ignores array and object query values instead of failing or passing them on', () => {
    expect(parseList({ q: ['a'], status: { $ne: 'x' }, sort: ['name'] }, options).filter).toEqual({});
  });

  it('turns ?q into an escaped, case-insensitive contains search', () => {
    const { filter } = parseList({ q: 'a.b*(c' }, options);
    const [clause] = filter.$or;
    const op = clause.name;
    expect(op.$regex).toBe('a\\.b\\*\\(c');
    expect(op.$options).toBe('i');
    expect(new RegExp(op.$regex, 'i').test('xxA.B*(Cyy')).toBe(true);
    expect(new RegExp(op.$regex, 'i').test('aXb')).toBe(false);
    expect(message(() => parseList({ q: 'x'.repeat(101) }, options))).toMatch(/^400 Invalid q/);
  });

  it('a 24-hex search also matches the document id', () => {
    const id = '64b000000000000000000001';
    expect(searchFilter(id, ['name']).$or).toContainEqual({ _id: id });
    expect(searchFilter('', ['name'])).toBeNull();
  });

  it('combines search and status with $and', () => {
    const { filter } = parseList({ q: 'a', status: 'open' }, options);
    expect(filter.$and).toHaveLength(2);
  });
});

describe('dashboard helpers', () => {
  it('lists 30 consecutive days ending today in Nazareth time', () => {
    const days = lastDays(new Date('2026-10-06T10:00:00Z'));
    expect(days).toHaveLength(30);
    expect(days[29]).toBe('2026-10-06');
    expect(days[0]).toBe('2026-09-07');
  });

  it('a late-evening UTC moment is already the next day in Nazareth', () => {
    expect(dayKey(new Date('2026-01-10T22:30:00Z'))).toBe('2026-01-11'); // UTC+2 in winter
    expect(lastDays(new Date('2026-01-10T22:30:00Z')).at(-1)).toBe('2026-01-11');
  });

  it('has no gaps or repeats across a month and year boundary', () => {
    const days = lastDays(new Date('2027-01-05T12:00:00Z'));
    expect(new Set(days).size).toBe(30);
    expect(days).toContain('2026-12-31');
    expect(days).toContain('2027-01-01');
    expect([...days].sort()).toEqual(days);
  });

  it('zero-fills days without data and ignores rows outside the window', () => {
    const days = ['2026-10-05', '2026-10-06'];
    const filled = zeroFill(days, [{ _id: '2026-10-06', orders: 2, revenue: 33.333 }, { _id: '2020-01-01', orders: 9, revenue: 9 }], [{ _id: '2026-10-05', candles: 4 }]);
    expect(filled).toEqual([
      { date: '2026-10-05', orders: 0, revenue: 0, candles: 4 },
      { date: '2026-10-06', orders: 2, revenue: 33.33, candles: 0 },
    ]);
  });
});
