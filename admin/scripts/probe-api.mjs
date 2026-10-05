// Probes the REAL API (run through the harness: `node ../server/test-harness/serve.mjs`) for behaviour and security
// cases: sign-in (enumeration, lockout, rate limit, case/Unicode variants, replay), tokens, roles, mass assignment,
// validation, mail on shipping, CSV injection, password policy, two-factor, audit and log injection.
// Usage: node scripts/probe-api.mjs        (it resets the harness first and prints PASS/FAIL/NOTE lines)
import crypto from 'node:crypto';
const API = 'http://127.0.0.1:3912';
let ipn = 0;
const ip = () => `10.55.${Math.floor(++ipn / 250)}.${(ipn % 250) + 1}`;
const out = [];
const check = (name, ok, extra = '') => { out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`); };
const note = (name, extra) => out.push(`NOTE  ${name}  -> ${extra}`);

async function req(method, path, { token, body, headers = {}, ipaddr = ip(), raw } = {}) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Forwarded-For': ipaddr, ...headers },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: r.status, json, text, headers: r.headers };
}
const login = async (username, password, extra = {}) => req('POST', '/admin/auth/login', { body: { username, password, ...extra }, ipaddr: extra.ipaddr });
await fetch(`${API}/__harness/reset`, { method: 'POST' });

// ---- login behaviours
const P = { owner: 'Owner-Mock-Pass-1', editor: 'Editor-Mock-Pass-1', viewer: 'Viewer-Mock-Pass-1' };
const o = await login('owner', P.owner);
check('login ok shape', o.status === 200 && o.json.expiresIn === 3600 && o.json.user.role === 'owner' && typeof o.json.token === 'string');
const ed = (await login('editor', P.editor)).json.token;
const vw = (await login('viewer', P.viewer)).json.token;
const ow = o.json.token;

// timing/enumeration: unknown vs wrong password
const t = async (u) => { const s = performance.now(); const r = await login(u, 'wrong-wrong-wrong-1'); return [performance.now() - s, r]; };
const [tu, ru] = await t('no-such-user-xyz'); const [tw, rw] = await t('owner');
check('unknown user and wrong password: same body and status', ru.status === 401 && rw.status === 401 && ru.text === rw.text, `${ru.text}`);
note('timing unknown vs wrong password (ms)', `${tu.toFixed(0)} vs ${tw.toFixed(0)}`);

// username case / unicode
const upper = await login('OWNER', P.owner);
check('username is case-sensitive at sign-in (OWNER is unknown)', upper.status === 401);
const full = await login('owner​', P.owner);
check('zero-width suffix does not match', full.status === 401);
const nfkc = await login('ｏｗｎｅｒ', P.owner);
check('full-width letters do not match', nfkc.status === 401);

// lockout: 5 wrong from different addresses, then the right password is refused (still 401, not 429)
for (let i = 0; i < 5; i++) await login('locktest', `bad-bad-bad-bad-${i}`);
const afterLock = await login('locktest', 'Locktest-Mock-Pass-1');
check('lockout after 5 failures (right password refused with the same 401)', afterLock.status === 401 && afterLock.json.error === 'Invalid credentials');
// lockout bypass via case variants
const variant = await login('LockTest', 'Locktest-Mock-Pass-1');
check('case variant of a locked name does not get in', variant.status === 401);

// rate limit by ip+username
let last = 0; const sameIp = '10.99.0.1';
for (let i = 0; i < 8 && last !== 429; i++) last = (await req('POST', '/admin/auth/login', { body: { username: 'ratelimit-probe', password: 'x'.repeat(12) }, ipaddr: sameIp })).status;
check('per address+name rate limit gives 429', last === 429);
// rate limit key: case variations of the name multiply the budget?
let variantsOk = 0;
for (const n of ['RATELIMIT-PROBE', 'Ratelimit-Probe']) { const r = await req('POST', '/admin/auth/login', { body: { username: n, password: 'x'.repeat(12) }, ipaddr: sameIp }); if (r.status === 429) variantsOk++; }
check('case variants of the name share the same rate-limit key', variantsOk === 2);
// X-Forwarded-For spoof: not an attack on the API alone (trust proxy 1) but note
const spoof = await req('POST', '/admin/auth/login', { body: { username: 'ratelimit-probe', password: 'x'.repeat(12) }, ipaddr: '203.0.113.77' });
note('a different X-Forwarded-For escapes the per-address limit (needs the account lock as the real brake)', `status ${spoof.status}`);

// malformed bodies
for (const [label, body] of [['array', []], ['null username', { username: null, password: 'x' }], ['object username', { username: { $ne: null }, password: 'x' }], ['huge', { username: 'a'.repeat(5000), password: 'x' }]]) {
  const r = await req('POST', '/admin/auth/login', { body });
  check(`login body ${label} -> 401 or 400/413 never 500`, [400, 401, 413].includes(r.status), String(r.status));
}
const bad = await req('POST', '/admin/auth/login', { raw: '{bad json', headers: { 'Content-Type': 'application/json' } });
check('invalid JSON -> 400', bad.status === 400, bad.text);
const urlenc = await req('POST', '/admin/auth/login', { raw: 'username=owner&password=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
check('form-encoded login does not crash', urlenc.status === 401, String(urlenc.status));

// ---- tokens
const none = await req('GET', '/admin/auth/me', { token: `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: '000000000000000000000001', role: 'owner', sid: 'x' })).toString('base64url')}.` });
check('alg=none token refused', none.status === 401);
const me = await req('GET', '/admin/auth/me', { token: ow });
check('me shape', me.status === 200 && me.json.username === 'owner' && 'lastLoginAt' in me.json);
check('no-store on admin answers', me.headers.get('cache-control') === 'no-store');
const noauth = await req('GET', '/admin/orders');
check('no token -> 401', noauth.status === 401);
const cors = await fetch(`${API}/admin/auth/me`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } });
check('CORS preflight from an unlisted origin refused', cors.status >= 400, String(cors.status));
const corsOk = await fetch(`${API}/admin/auth/me`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:3911', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
check('CORS preflight from ADMIN_ORIGINS allowed', corsOk.status === 204 && corsOk.headers.get('access-control-allow-origin') === 'http://localhost:3911', String(corsOk.status));
const corsSlash = await fetch(`${API}/admin/auth/me`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:3911/', 'Access-Control-Request-Method': 'GET' } });
note('origin with trailing slash (browsers never send one)', String(corsSlash.status));

// ---- role matrix through the API
const ids = {};
for (const [k, p] of [['orders', 'orders'], ['candles', 'candles'], ['contacts', 'contacts'], ['site-reviews', 'site-reviews'], ['product-reviews', 'product-reviews'], ['prayers', 'prayers'], ['products', 'products']]) {
  ids[k] = (await req('GET', `/admin/${p}?size=1`, { token: ow })).json.items[0]._id;
}
const matrix = [];
const expectFor = (role, m, path) => {
  const w = ['owner', 'editor'].includes(role);
  if (path.startsWith('/admin/users') || path.startsWith('/admin/audit')) return role === 'owner';
  if (m === 'GET') return path.includes('/export/') ? w : true;
  if (path.startsWith('/admin/orders') && m === 'DELETE') return role === 'owner';
  return w;
};
const tokens = { owner: ow, editor: ed, viewer: vw };
const probes = [
  ['GET', '/admin/dashboard'], ['GET', '/admin/orders'], ['GET', `/admin/orders/${ids.orders}`], ['GET', '/admin/export/orders.csv'], ['GET', '/admin/users'], ['GET', '/admin/audit'],
  ['PATCH', `/admin/candles/${ids.candles}`, { done: true }], ['PATCH', `/admin/site-reviews/${ids['site-reviews']}`, { approved: true }],
  ['POST', '/admin/products', { name: 'Matrix item', price: 5, img: 'https://example.com/a.jpg' }],
  ['POST', '/admin/users', { username: 'matrixuser', password: 'Matrix-User-Pass-9', role: 'viewer' }],
];
for (const [m, p, b] of probes) {
  for (const role of ['owner', 'editor', 'viewer']) {
    const r = await req(m, p, { token: tokens[role], body: b });
    const allowed = r.status < 400;
    matrix.push(`${m} ${p.replace(/[0-9a-f]{24}/, ':id')} ${role}: ${r.status}`);
    if (allowed !== expectFor(role, m, p)) check(`role matrix ${m} ${p} as ${role}`, false, String(r.status));
  }
}
check('role matrix (30 probes) matches docs/ADMIN.md', !out.some((l) => l.includes('role matrix') && l.startsWith('FAIL')));
// order delete by editor / viewer
check('editor cannot delete an order', (await req('DELETE', `/admin/orders/${ids.orders}`, { token: ed })).status === 403);
check('viewer cannot delete a prayer', (await req('DELETE', `/admin/prayers/${ids.prayers}`, { token: vw })).status === 403);
check('viewer cannot PUT a product', (await req('PUT', `/admin/products/${ids.products}`, { token: vw, body: { name: 'hacked' } })).status === 403);

// ---- role escalation / mass assignment
const meId = me.json.id;
check('PATCH own role refused (400)', (await req('PATCH', `/admin/users/${meId}`, { token: ow, body: { role: 'viewer' } })).status === 400);
const edId = (await req('GET', '/admin/auth/me', { token: ed })).json.id;
check('editor cannot PATCH own role to owner (403)', (await req('PATCH', `/admin/users/${edId}`, { token: ed, body: { role: 'owner' } })).status === 403);
check('mass assignment on users: unknown field refused', (await req('POST', '/admin/users', { token: ow, body: { username: 'massuser', password: 'Mass-Assign-Pass-9', role: 'viewer', disabled: false, totpEnabled: true } })).status === 400);
check('mass assignment on products: _id refused', (await req('POST', '/admin/products', { token: ow, body: { name: 'abc', price: 5, img: 'https://x.example/a.jpg', _id: '000000000000000000000abc' } })).status === 400);
check('mass assignment on orders PATCH: other fields refused', (await req('PATCH', `/admin/orders/${ids.orders}`, { token: ow, body: { done: true, totalPrice: 0 } })).status === 400);
check('self delete refused', (await req('DELETE', `/admin/users/${meId}`, { token: ow })).status === 400);
check('self disable refused', (await req('PATCH', `/admin/users/${meId}`, { token: ow, body: { disabled: true } })).status === 400);
// last owner: demote all other owners then try to demote/delete the last via the sole remaining owner? (self is blocked; need a 2nd owner)
const users = (await req('GET', '/admin/users?size=100', { token: ow })).json.items;
const owners = users.filter((u) => u.role === 'owner');
note('owners present', owners.map((u) => u.username).join(','));
// ordinary user create + duplicate by case
const mk = await req('POST', '/admin/users', { token: ow, body: { username: 'Casey.Test', password: 'Casey-Test-Pass-77', role: 'editor' } });
check('create user 201 with {item}', mk.status === 201 && mk.json.item?.username === 'Casey.Test', JSON.stringify(mk.json).slice(0, 100));
check('duplicate by case 409', (await req('POST', '/admin/users', { token: ow, body: { username: 'casey.test', password: 'Casey-Test-Pass-77', role: 'viewer' } })).status === 409);
check('weak password refused on create', (await req('POST', '/admin/users', { token: ow, body: { username: 'weakling', password: 'short', role: 'viewer' } })).status === 400);
check('unicode username refused', (await req('POST', '/admin/users', { token: ow, body: { username: 'ｗｅａｋ', password: 'Casey-Test-Pass-77', role: 'viewer' } })).status === 400);
const caseyId = mk.json.item._id;
// session revoked on role change
const caseyTok = (await login('Casey.Test', 'Casey-Test-Pass-77')).json.token;
check('new user can sign in and read', (await req('GET', '/admin/orders?size=1', { token: caseyTok })).status === 200);
await req('PATCH', `/admin/users/${caseyId}`, { token: ow, body: { role: 'viewer' } });
check('role change ends the user\'s sessions at once', (await req('GET', '/admin/orders?size=1', { token: caseyTok })).status === 401);
// last owner guard: make Casey owner, then casey demotes ... only by race. Try: demote all other owners one at a time.
for (const u of owners.filter((x) => x.username !== 'owner')) {
  const r = await req('PATCH', `/admin/users/${u._id}`, { token: ow, body: { role: 'editor' } });
  if (r.status !== 200) note('demote other owner', `${u.username} -> ${r.status}`);
}
const lastCheck = await req('PATCH', `/admin/users/${meId}`, { token: ow, body: { role: 'editor' } });
check('cannot demote the last owner (self-guard answers first)', lastCheck.status === 400 || lastCheck.status === 409, String(lastCheck.status));
await fetch(`${API}/__harness/reset`, { method: 'POST' });
const ow2 = (await login('owner', P.owner)).json.token;

// ---- validation
const GOOD = { name: 'Valid product', price: 12.5, img: 'https://example.com/p.jpg' };
const vcases = [
  ['name too short', { ...GOOD, name: 'a' }], ['price zero', { ...GOOD, price: 0 }], ['price string', { ...GOOD, price: '12' }], ['price huge', { ...GOOD, price: 99999 }],
  ['img javascript:', { ...GOOD, img: 'javascript:alert(1)' }], ['img data:', { ...GOOD, img: 'data:text/html,hi' }], ['img with space', { ...GOOD, img: 'https://x.example/a b.jpg' }],
  ['stock negative', { ...GOOD, stock: -1 }], ['stock float', { ...GOOD, stock: 1.5 }], ['category unknown', { ...GOOD, category: 'Candles' }], ['rate 6', { ...GOOD, rate: 6 }],
  ['color not list', { ...GOOD, color: 'red' }], ['additionalImageUrls 21', { ...GOOD, additionalImageUrls: Array(21).fill('https://x.example/a.jpg') }],
  ['name object', { ...GOOD, name: { $gt: '' } }], ['control chars', { ...GOOD, name: 'ab\u0000cd' }], ['multiline name', { ...GOOD, name: 'ab\ncd' }],
];
for (const [label, body] of vcases) check(`product validation: ${label} -> 400`, (await req('POST', '/admin/products', { token: ow2, body })).status === 400);
const created = await req('POST', '/admin/products', { token: ow2, body: { ...GOOD, name: 'Salt & Pepper <b>bold</b> <script>x</script>', description: 'a < b && c > d' } });
check('product create 201 {item}', created.status === 201 && created.json.item?._id);
note('stored text for "Salt & Pepper <b>bold</b> <script>x</script>"', JSON.stringify(created.json.item?.name));
note('stored description for "a < b && c > d"', JSON.stringify(created.json.item?.description));
const pid = created.json.item._id;
const upd = await req('PUT', `/admin/products/${pid}`, { token: ow2, body: { price: 20 } });
check('PUT partial update works', upd.status === 200 && upd.json.item.price === 20);
check('PUT empty body 400', (await req('PUT', `/admin/products/${pid}`, { token: ow2, body: {} })).status === 400);
check('PATCH works too', (await req('PATCH', `/admin/products/${pid}`, { token: ow2, body: { stock: null } })).status === 200);
check('delete product -> {message}', (await req('DELETE', `/admin/products/${pid}`, { token: ow2 })).json?.message === 'Product deleted');

// ---- ids, query abuse, ReDoS
check('malformed id 400', (await req('GET', '/admin/orders/not-an-id', { token: ow2 })).status === 400);
check('NoSQL in query: status[$ne]=x is ignored, never an operator', (await req('GET', '/admin/orders?status[$ne]=x', { token: ow2 })).json?.total === 42);
check('q as array ignored', (await req('GET', '/admin/orders?q[]=a&q[]=b', { token: ow2 })).status === 200);
check('q over 100 chars 400', (await req('GET', `/admin/orders?q=${'a'.repeat(101)}`, { token: ow2 })).status === 400);
const rs = performance.now(); await req('GET', `/admin/orders?q=${encodeURIComponent('(a+)+$'.repeat(10))}`, { token: ow2 }); note('ReDoS-style q (escaped literal) time ms', (performance.now() - rs).toFixed(0));
check('sort injection 400', (await req('GET', '/admin/orders?sort=-createdAt;drop', { token: ow2 })).status === 400);
check('audit action regex injection refused', (await req('GET', '/admin/audit?action=' + encodeURIComponent('.*'), { token: ow2 })).status === 400);
check('audit actor as object refused', (await req('GET', '/admin/audit?actor[$ne]=x', { token: ow2 })).status === 400);

// ---- shipping + mail
const pending = (await req('GET', '/admin/orders?status=pending&size=1', { token: ow2 })).json.items[0];
const s1 = await req('PATCH', `/admin/orders/${pending._id}`, { token: ow2, body: { done: true } });
const s2 = await req('PATCH', `/admin/orders/${pending._id}`, { token: ow2, body: { done: true } });
const mails = await (await fetch(`${API}/__harness/emails`)).json();
check('ship: emailSent true then null; exactly one mail', s1.json.emailSent === true && s2.json.emailSent === null && mails.filter((m) => m.subject.includes('shipped')).length === 1, JSON.stringify([s1.json.emailSent, s2.json.emailSent, mails.length]));
check('mail goes to the customer', mails[0]?.to?.[0] === pending.email, JSON.stringify(mails[0]?.to));
await fetch(`${API}/__harness/mail`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fail: true }) });
const pending2 = (await req('GET', '/admin/orders?status=pending&size=1', { token: ow2 })).json.items[0];
const s3 = await req('PATCH', `/admin/orders/${pending2._id}`, { token: ow2, body: { done: true } });
check('mail failure: change kept, emailSent false', s3.status === 200 && s3.json.emailSent === false && s3.json.item.done === true);
await fetch(`${API}/__harness/mail`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fail: false }) });

// ---- CSV
const csv = await req('GET', '/admin/export/orders.csv', { token: ow2 });
check('csv headers', /text\/csv/.test(csv.headers.get('content-type')) && /attachment; filename="orders-\d{4}-\d{2}-\d{2}\.csv"/.test(csv.headers.get('content-disposition')) && csv.headers.get('x-content-type-options') === 'nosniff');
check('csv CRLF line ends (fetch hides the BOM; the e2e suite checks it)', csv.text.includes('\r\n'));
check('csv: formula cells neutralised', csv.text.includes("'-2+3") && !/(^|,)[=+@-][^,\r\n]*/m.test(csv.text.replace(/^﻿/, '').split('\r\n').slice(1).join('\r\n').replace(/"[^"]*"/g, '""').replace(/,-?\d+(\.\d+)?(,|$)/g, ',')) );
const cc = await req('GET', '/admin/export/candles.csv', { token: ow2 });
check('csv: candle prayer starting with = neutralised and decoded', cc.text.includes(`'=HYPERLINK("`.replace(/"/g, '""')) || cc.text.includes("'=HYPERLINK"), cc.text.split('\r\n').find((l) => l.includes('HYPERLINK'))?.slice(0, 120));
check('csv unknown file 404', (await req('GET', '/admin/export/users.csv', { token: ow2 })).status === 404);

// ---- password and totp
const pw = async (tok, cur, nw) => req('POST', '/admin/auth/password', { token: tok, body: { currentPassword: cur, newPassword: nw } });
const pc = (await login('tempowner', 'Tempowner-Mock-Pass-1')).json.token;
// each wrong try counts toward the account's 5 per 15 minutes: stay under it (the 'same' case is covered by probe-pw)
for (const [label, nw] of [['short', 'abc'], ['username', 'tempowner'], ['common', 'password1234'], ['repetitive', 'aaaaaaaaaaaaaaa']]) check(`password policy: ${label} -> 400`, (await pw(pc, 'Tempowner-Mock-Pass-1', nw)).status === 400);
check('password with & < > accepted and works', (await pw(pc, 'Tempowner-Mock-Pass-1', 'Fish&Chips<>-Pass-2026')).status === 204);
check('new password with & < > signs in', (await login('tempowner', 'Fish&Chips<>-Pass-2026')).status === 200);
// TOTP
function b32d(s) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const o = []; for (const c of s) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); }
const code = (secret, off = 0) => { const c = Math.floor(Date.now() / 30000) + off; const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(c)); const h = crypto.createHmac('sha1', b32d(secret)).update(m).digest(); const o2 = h[h.length - 1] & 15; return String(((h[o2] & 0x7f) << 24 | h[o2 + 1] << 16 | h[o2 + 2] << 8 | h[o2 + 3]) % 1e6).padStart(6, '0'); };
const ts = (await login('totpsetup', 'Totpsetup-Mock-Pass-1')).json.token;
const setup = await req('POST', '/admin/auth/totp/setup', { token: ts });
check('totp setup returns secret + otpauthUrl', setup.status === 200 && /^otpauth:\/\/totp\//.test(setup.json.otpauthUrl));
check('totp enable wrong code 400', (await req('POST', '/admin/auth/totp/enable', { token: ts, body: { code: '000000' } })).status === 400);
check('totp enable ok', (await req('POST', '/admin/auth/totp/enable', { token: ts, body: { code: code(setup.json.secret, -1) } })).status === 204);
const l1 = await login('totpsetup', 'Totpsetup-Mock-Pass-1');
check('login without code -> 428 totp_required', l1.status === 428 && l1.json.error === 'totp_required');
const l2 = await login('totpsetup', 'Totpsetup-Mock-Pass-1', { totp: code(setup.json.secret, 0) });
check('login with current code ok', l2.status === 200);
const l3 = await login('totpsetup', 'Totpsetup-Mock-Pass-1', { totp: code(setup.json.secret, 0) });
check('REPLAY of the same code refused', l3.status === 401);
const l4 = await login('totpsetup', 'Totpsetup-Mock-Pass-1', { totp: code(setup.json.secret, -1) });
check('older step refused after a newer one was used', l4.status === 401);
check('428 body for unknown user does not exist (user enumeration): unknown user + totp', (await login('nobody-here', 'xxxxxxxxxxxxxxx', { totp: '123456' })).status === 401);
check('totp setup twice 409', (await req('POST', '/admin/auth/totp/setup', { token: ts })).status === 409);

// ---- audit
const aud = (await req('GET', '/admin/audit?size=100', { token: ow2 })).json;
const actions = new Set(aud.items.map((e) => e.action));
check('audit has entries of every kind done here', ['auth.login', 'auth.login_failed', 'order.update', 'product.create', 'product.update', 'product.delete', 'export.orders', 'auth.password_change', 'auth.totp_enable'].every((a) => actions.has(a)), [...actions].join(','));
check('audit never holds a password or token', !/Mock-Pass|Fish&Chips|eyJ/.test(JSON.stringify(aud)));
check('audit entry shape', ['at', 'actorName', 'role', 'action', 'target', 'ipHash', 'ua'].every((k) => k in aud.items[0]));
await login('evil\r\nFAKE LOG LINE auth.login owner', 'x'.repeat(12));
const aud2 = (await req('GET', '/admin/audit?size=5&action=auth.login_failed', { token: ow2 })).json;
check('log injection: newline in the typed name is flattened in the audit log', !/[\r\n]/.test(aud2.items[0].actorName), JSON.stringify(aud2.items[0].actorName));
check('audit PATCH/DELETE/POST not routed (tamper)', [(await req('DELETE', `/admin/audit/${aud.items[0]._id}`, { token: ow2 })).status, (await req('PATCH', `/admin/audit/${aud.items[0]._id}`, { token: ow2, body: {} })).status, (await req('POST', '/admin/audit', { token: ow2, body: {} })).status].every((s) => s === 404 || s === 405));

// ---- logout
const lt = (await login('viewer', P.viewer)).json.token;
check('logout 204', (await req('POST', '/admin/auth/logout', { token: lt })).status === 204);
check('token dead after logout', (await req('GET', '/admin/auth/me', { token: lt })).status === 401);

// headers
const h = await req('GET', '/health');
check('helmet headers on the API', h.headers.get('x-content-type-options') === 'nosniff' && /frame-ancestors 'none'/.test(h.headers.get('content-security-policy') ?? '') && !h.headers.get('x-powered-by'));
console.log(out.join('\n'));
console.log('\nMATRIX (sample):\n' + matrix.slice(0, 12).join('\n'));
