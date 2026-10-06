// The mock (admin/mock-api) and the REAL API (server/, run through server/test-harness) must agree. This test starts
// both, runs one script against each and compares status codes and the SHAPE of every answer (keys and types, not
// values: the two have different seed data). It also parses the real answers with the dashboard's own zod schemas,
// which is how mismatches like the audit field names and the missing detail routes were found.
//
// It needs server/node_modules (the harness imports the real server code); without it the test is skipped.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  auditPage, candlesPage, contactsPage, dashboardSchema, loginResponseSchema, meSchema, ordersPage, prayersPage, productReviewsPage,
  liveStartSchema, liveStateSchema, liveStopSchema, paymentsPage, privacyEraseSchema, privacyLookupSchema, productSchema, productsPage,
  siteReviewsPage, totpSetupSchema, usersPage, WHIP_URL,
} from '@/lib/api';
import { totpCode } from '../../mock-api/totp.mjs';

const root = path.resolve(__dirname, '../..');
const serverDir = path.resolve(root, '../server');
const haveServer = fs.existsSync(path.join(serverDir, 'node_modules', 'express'));

type Reply = { status: number; json: unknown; text: string; headers: Headers };
type Backend = { name: string; base: string; process?: ChildProcess; reset(options?: { accounts?: boolean }): Promise<void>; emails(): Promise<{ subject: string; to: string[]; text: string }[]>; mail(fail: boolean): Promise<void>; live(options: { configured?: boolean; failCreate?: boolean }): Promise<void> };

const freePort = () => new Promise<number>((resolve) => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => { const { port } = server.address() as net.AddressInfo; server.close(() => resolve(port)); });
});

async function waitFor(url: string, ms = 60_000) {
  const until = Date.now() + ms;
  for (;;) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    if (Date.now() > until) throw new Error(`${url} did not start`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

let mock: Backend;
let real: Backend;

beforeAll(async () => {
  if (!haveServer) return;
  const [mockPort, realPort] = [await freePort(), await freePort()];
  const mockProcess = spawn(process.execPath, ['mock-api/server.mjs'], { cwd: root, env: { ...process.env, MOCK_PORT: String(mockPort) }, stdio: 'ignore' });
  const realProcess = spawn(process.execPath, ['test-harness/serve.mjs'], { cwd: serverDir, env: { ...process.env, HARNESS: '1', HARNESS_PORT: String(realPort) }, stdio: 'ignore' });
  const json = (method: string, url: string, body?: unknown) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  mock = {
    name: 'mock', base: `http://127.0.0.1:${mockPort}`, process: mockProcess,
    reset: async (options = {}) => { await json('POST', `http://127.0.0.1:${mockPort}/__mock/reset`, options); },
    emails: async () => (await (await fetch(`http://127.0.0.1:${mockPort}/__mock/emails`)).json()),
    mail: async (fail) => { await json('POST', `http://127.0.0.1:${mockPort}/__mock/mail`, { fail }); },
    live: async (options) => { await json('POST', `http://127.0.0.1:${mockPort}/__mock/live`, options); },
  };
  real = {
    name: 'real', base: `http://127.0.0.1:${realPort}`, process: realProcess,
    reset: async (options = {}) => { await json('POST', `http://127.0.0.1:${realPort}/__harness/reset`, options); },
    emails: async () => (await (await fetch(`http://127.0.0.1:${realPort}/__harness/emails`)).json()),
    mail: async (fail) => { await json('POST', `http://127.0.0.1:${realPort}/__harness/mail`, { fail }); },
    live: async (options) => { await json('POST', `http://127.0.0.1:${realPort}/__harness/live`, options); },
  };
  await Promise.all([waitFor(`${mock.base}/__mock/health`), waitFor(`${real.base}/__harness/health`)]);
}, 90_000);

afterAll(() => {
  mock?.process?.kill();
  real?.process?.kill();
});

// ---- helpers

let ipCounter = 0;
const ip = () => `10.123.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;

function client(backend: Backend, token?: string) {
  return async (method: string, p: string, body?: unknown, headers: Record<string, string> = {}): Promise<Reply> => {
    const res = await fetch(`${backend.base}${p}`, {
      method,
      headers: { 'X-Forwarded-For': ip(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* csv or empty */ }
    return { status: res.status, json: parsed, text, headers: res.headers };
  };
}

async function signIn(backend: Backend, username: string, password: string, extra: Record<string, unknown> = {}) {
  const res = await client(backend)('POST', '/admin/auth/login', { username, password, ...extra });
  return { res, token: (res.json as { token?: string } | null)?.token ?? '' };
}

const PASSWORDS: Record<string, string> = { owner: 'Owner-Mock-Pass-1', editor: 'Editor-Mock-Pass-1', viewer: 'Viewer-Mock-Pass-1' };

/** The structure of a JSON value: keys and types, not values (ids and dates are named as such). Lists merge their items. */
export function shape(value: unknown): unknown {
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.length === 0 ? [] : [value.map(shape).reduce(mergeShapes)];
  if (typeof value === 'string') return /^[a-f0-9]{24}$/.test(value) ? 'id' : /^\d{4}-\d\d-\d\d(T|$)/.test(value) ? 'date' : 'string';
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value as object).sort().map((k) => [k, shape((value as Record<string, unknown>)[k])]));
  return typeof value;
}

function mergeShapes(a: unknown, b: unknown): unknown {
  if (JSON.stringify(a) === JSON.stringify(b)) return a;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return Object.fromEntries([...keys].sort().map((k) => [k, k in a && k in b ? mergeShapes((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]) : (k in a ? (a as Record<string, unknown>)[k] : (b as Record<string, unknown>)[k])]));
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === 0 ? b : b.length === 0 ? a : [mergeShapes(a[0], b[0])];
  if (Array.isArray(a) && a.length === 0) return b;
  if (Array.isArray(b) && b.length === 0) return a;
  return `${String(a)}|${String(b)}`; // a field that is sometimes null (or another type) in the same list
}

// Fields that exist in one backend only for reasons that do not matter to a client.
const IGNORE = new Set(['__v', 'ipHash']);
const strip = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !IGNORE.has(k)).map(([k, v]) => [k, strip(v)]));
  return value;
};

type Step = { label: string; status: number; shape: unknown };
const record = (label: string, r: Reply): Step => ({ label, status: r.status, shape: r.json === null ? (r.text ? 'text' : 'empty') : shape(strip(r.json)) });

const firstId = (r: Reply) => ((r.json as { items: { _id?: string; id?: string }[] }).items[0]._id ?? (r.json as { items: { id: string }[] }).items[0].id) as string;

async function scenario(backend: Backend): Promise<{ steps: Step[]; replies: Record<string, Reply> }> {
  await backend.reset();
  const steps: Step[] = [];
  const replies: Record<string, Reply> = {};
  const add = (label: string, r: Reply) => { steps.push(record(label, r)); replies[label] = r; return r; };

  const owner = await signIn(backend, 'owner', PASSWORDS.owner);
  add('login', owner.res);
  const editor = await signIn(backend, 'editor', PASSWORDS.editor);
  const viewer = await signIn(backend, 'viewer', PASSWORDS.viewer);
  const O = client(backend, owner.token);
  const E = client(backend, editor.token);
  const V = client(backend, viewer.token);

  add('me', await O('GET', '/admin/auth/me'));
  add('dashboard', await O('GET', '/admin/dashboard'));

  // every list: shape, filters, bad filter/sort answers
  const lists: [string, string[]][] = [
    ['orders', ['pending', 'shipped', 'unverified']], ['candles', ['pending', 'done']], ['contacts', ['open', 'done']], ['site-reviews', ['approved', 'hidden']],
    ['product-reviews', ['approved', 'hidden']], ['prayers', ['Peace']], ['products', ['ok', 'low', 'out']], ['users', ['active', 'owner', 'editor', 'viewer', 'disabled']],
    ['payments', ['unfulfilled', 'captured', 'created', 'failed', 'resolved', 'order', 'candle', 'donation']],
  ];
  const ids: Record<string, string> = {};
  for (const [name, statuses] of lists) {
    const list = add(`list ${name}`, await O('GET', `/admin/${name}?size=2`));
    ids[name] = firstId(list);
    for (const status of statuses) add(`list ${name} status=${status}`, await O('GET', `/admin/${name}?status=${status}&size=1`));
    add(`list ${name} status=bogus`, await O('GET', `/admin/${name}?status=bogus`));
    add(`list ${name} sort=bogus`, await O('GET', `/admin/${name}?sort=bogus`));
    add(`list ${name} q too long`, await O('GET', `/admin/${name}?q=${'a'.repeat(101)}`));
    if (name !== 'users') add(`detail ${name}`, await O('GET', `/admin/${name}/${ids[name]}`));
    add(`detail ${name} bad id`, await O('GET', `/admin/${name}/not-an-id`));
    add(`detail ${name} unknown id`, await O('GET', `/admin/${name}/${'0'.repeat(23)}9`));
    add(`viewer lists ${name}`, await V('GET', `/admin/${name}?size=1`));
  }
  add('list audit', await O('GET', '/admin/audit?size=2'));
  add('list audit action prefix', await O('GET', '/admin/audit?action=auth.&size=1'));
  add('list audit bad action', await O('GET', '/admin/audit?action=.*'));

  // changes
  const ship = add('ship order', await E('PATCH', `/admin/orders/${await (async () => firstId(await O('GET', '/admin/orders?status=pending&size=1')))()}`, { done: true }));
  const shippedId = (ship.json as { item: { _id: string } }).item._id;
  add('ship order again', await E('PATCH', `/admin/orders/${shippedId}`, { done: true }));
  add('ship order: extra field', await E('PATCH', `/admin/orders/${shippedId}`, { done: true, totalPrice: 0 }));
  add('ship order: wrong type', await E('PATCH', `/admin/orders/${shippedId}`, { done: 'yes' }));
  add('unship order', await E('PATCH', `/admin/orders/${shippedId}`, { done: false }));
  steps.push({ label: 'mails after ship, ship again, unship', status: 0, shape: (await backend.emails()).filter((m) => /shipped/i.test(m.subject)).length });
  const pendingAgain = firstId(await O('GET', '/admin/orders?status=pending&size=1'));
  await backend.mail(true);
  add('ship order: mail fails', await E('PATCH', `/admin/orders/${pendingAgain}`, { done: true }));
  await backend.mail(false);
  add('viewer cannot ship', await V('PATCH', `/admin/orders/${pendingAgain}`, { done: true }));
  add('editor cannot delete order', await E('DELETE', `/admin/orders/${shippedId}`));
  add('owner deletes order', await O('DELETE', `/admin/orders/${shippedId}`));
  add('candle done', await E('PATCH', `/admin/candles/${ids.candles}`, { done: true }));
  add('contact done', await E('PATCH', `/admin/contacts/${ids.contacts}`, { done: true }));
  add('site review hide', await E('PATCH', `/admin/site-reviews/${ids['site-reviews']}`, { approved: false }));
  add('product review hide', await E('PATCH', `/admin/product-reviews/${ids['product-reviews']}`, { approved: false }));
  add('prayer has no PATCH', await E('PATCH', `/admin/prayers/${ids.prayers}`, { approved: false }));
  add('prayer delete', await E('DELETE', `/admin/prayers/${ids.prayers}`));
  add('prayer delete again', await E('DELETE', `/admin/prayers/${ids.prayers}`));
  add('candle delete: viewer', await V('DELETE', `/admin/candles/${ids.candles}`));
  add('candle delete', await E('DELETE', `/admin/candles/${ids.candles}`));

  // products
  const good = { name: 'Parity & Co <i>', price: 12.5, img: 'https://example.com/a.jpg', stock: 3, category: 'gifts', color: ['red'], description: 'a < b', rate: 2, uuidv4_: 'u-1', additionalImageUrls: ['https://example.com/b.jpg'] };
  const created = add('product create', await E('POST', '/admin/products', good));
  const productId = (created.json as { item: { _id: string } }).item._id;
  for (const [label, patch] of Object.entries({
    'name too short': { name: 'a' }, 'price zero': { price: 0 }, 'bad img': { img: 'javascript:alert(1)' }, 'category free text': { category: 'Candles' }, 'stock float': { stock: 1.5 },
    'extra field': { _id: 'x' }, 'rate 6': { rate: 6 }, 'colour not a list': { color: 'red' },
  })) add(`product create invalid: ${label}`, await E('POST', '/admin/products', { ...good, ...patch }));
  add('product create: viewer', await V('POST', '/admin/products', good));
  add('product create: missing fields', await E('POST', '/admin/products', { name: 'Only a name' }));
  add('product PUT', await E('PUT', `/admin/products/${productId}`, { price: 20, stock: null, category: null }));
  add('product PATCH', await E('PATCH', `/admin/products/${productId}`, { name: 'Renamed & done' }));
  add('product PUT empty', await E('PUT', `/admin/products/${productId}`, {}));
  add('product detail after update', await O('GET', `/admin/products/${productId}`));
  add('product delete', await E('DELETE', `/admin/products/${productId}`));
  add('product delete again', await E('DELETE', `/admin/products/${productId}`));

  // payments: resolve with a note, reopen, and what cannot be done (the ledger has no delete)
  const unfulfilled = (await O('GET', '/admin/payments?status=unfulfilled&size=1')).json as { items: { _id: string }[] };
  const lostId = unfulfilled.items[0]._id;
  const linked = ((await O('GET', '/admin/payments?size=100')).json as { items: { _id: string; linkedTo?: { id?: string } }[] }).items.find((p) => p.linkedTo?.id)!;
  add('payment resolve without a note', await E('PATCH', `/admin/payments/${lostId}`, { resolved: true }));
  add('payment resolve with a blank note', await E('PATCH', `/admin/payments/${lostId}`, { resolved: true, note: '   ' }));
  add('payment resolve: unknown field', await E('PATCH', `/admin/payments/${lostId}`, { resolved: true, note: 'x', amount: 1 }));
  add('payment resolve: viewer', await V('PATCH', `/admin/payments/${lostId}`, { resolved: true, note: 'x' }));
  add('payment resolve: already linked', await E('PATCH', `/admin/payments/${linked._id}`, { resolved: true, note: 'x' }));
  add('payment resolve', await E('PATCH', `/admin/payments/${lostId}`, { resolved: true, note: 'Refunded in PayPal & told the customer <b>' }));
  add('payment unfulfilled after resolve', await O('GET', '/admin/payments?status=unfulfilled&size=1'));
  add('payment reopen', await E('PATCH', `/admin/payments/${lostId}`, { resolved: false }));
  add('payment has no DELETE', await O('DELETE', `/admin/payments/${lostId}`));
  add('payment has no POST', await O('POST', '/admin/payments', { paypalOrderId: 'X' }));
  add('payment unknown id', await E('PATCH', `/admin/payments/${'0'.repeat(23)}9`, { resolved: false }));
  add('dashboard alert after changes', await O('GET', '/admin/dashboard'));

  // privacy (owner only): look up and erase one address. Both seeds hold one lost order by lost.order@example.com.
  const lookup = add('privacy lookup', await O('POST', '/admin/privacy/lookup', { email: ' Lost.Order@Example.com ' }));
  steps.push({ label: 'privacy lookup counts', status: 0, shape: (lookup.json as { found: unknown }).found });
  add('privacy lookup: nobody', await O('POST', '/admin/privacy/lookup', { email: 'nobody@example.com' }));
  add('privacy lookup: editor', await E('POST', '/admin/privacy/lookup', { email: 'lost.order@example.com' }));
  add('privacy lookup: not an address', await O('POST', '/admin/privacy/lookup', { email: 'nope' }));
  add('privacy lookup: the placeholder', await O('POST', '/admin/privacy/lookup', { email: 'erased@erased.invalid' }));
  add('privacy lookup: extra field', await O('POST', '/admin/privacy/lookup', { email: 'a@b.co', all: true }));
  add('privacy erase: confirmation differs', await O('POST', '/admin/privacy/erase', { email: 'lost.order@example.com', confirm: 'other@example.com' }));
  add('privacy erase: no confirmation', await O('POST', '/admin/privacy/erase', { email: 'lost.order@example.com' }));
  add('privacy erase: editor', await E('POST', '/admin/privacy/erase', { email: 'lost.order@example.com', confirm: 'lost.order@example.com' }));
  const erased = add('privacy erase', await O('POST', '/admin/privacy/erase', { email: 'lost.order@example.com', confirm: 'LOST.order@example.com' }));
  steps.push({ label: 'privacy erase counts', status: 0, shape: (erased.json as { erased: unknown }).erased });
  add('privacy lookup after erase', await O('POST', '/admin/privacy/lookup', { email: 'lost.order@example.com' }));
  add('privacy lookup is audited (GET audit)', await O('GET', '/admin/audit?action=privacy.&size=1'));
  add('privacy GET is not a route', await O('GET', '/admin/privacy/lookup'));

  // live broadcasting (docs/LIVE.md): one at a time, the WHIP address only in the answer to start, the public status
  const P0 = client(backend);
  add('live state (nothing yet)', await E('GET', '/admin/live'));
  add('live state: viewer', await V('GET', '/admin/live'));
  add('live start: viewer', await V('POST', '/admin/live/start', { title: 'x' }));
  add('live start: no title', await E('POST', '/admin/live/start', {}));
  add('live start: blank title', await E('POST', '/admin/live/start', { title: '   ' }));
  add('live start: title too long', await E('POST', '/admin/live/start', { title: 'x'.repeat(121) }));
  add('live start: extra field', await E('POST', '/admin/live/start', { title: 'x', force: true }));
  const liveStart = add('live start', await E('POST', '/admin/live/start', { title: 'Evening prayer & vespers' }));
  const liveBody = liveStart.json as { whipUrl: string; session: { _id: string } };
  steps.push({ label: 'live start: the WHIP address has the Cloudflare shape', status: 0, shape: WHIP_URL.test(liveBody.whipUrl) });
  add('live start again: 409', await O('POST', '/admin/live/start', { title: 'Another' }));
  const afterStart = [
    add('live state (live)', await O('GET', '/admin/live')),
    add('live public status (live)', await P0('GET', '/live/status')),
    add('live stop: an owner must confirm', await O('POST', '/admin/live/stop', {})),
    add('live stop: an older session id', await E('POST', '/admin/live/stop', { sessionId: `${'0'.repeat(23)}9` })),
    add('live stop: bad session id', await E('POST', '/admin/live/stop', { sessionId: 'nope' })),
    add('live stop: viewer', await V('POST', '/admin/live/stop', {})),
    add('live stop', await E('POST', '/admin/live/stop', { sessionId: liveBody.session._id })),
    add('live stop again', await E('POST', '/admin/live/stop', {})),
    add('live public status (ended)', await P0('GET', '/live/status')),
    add('live state (after the stop)', await E('GET', '/admin/live')),
    add('live audit', await O('GET', '/admin/audit?action=live.&size=5')),
  ];
  steps.push({ label: 'live: no other answer carries the WHIP address', status: 0, shape: afterStart.every((r) => !r.text.includes('webRTC/publish')) });
  add('live force: start as editor, end as owner', (await E('POST', '/admin/live/start', { title: 'Forced' }), await O('POST', '/admin/live/stop', { force: true })));
  await backend.live({ failCreate: true });
  add('live start: Cloudflare refuses', await E('POST', '/admin/live/start', { title: 'Outage' }));
  await backend.live({ failCreate: false, configured: false });
  add('live state: not configured', await E('GET', '/admin/live'));
  add('live start: not configured', await E('POST', '/admin/live/start', { title: 'Nothing' }));
  await backend.live({ configured: true });

  // users
  const me = (owner.res.json as { user: { id: string } }).user.id;
  const made = add('user create', await O('POST', '/admin/users', { username: 'Casey.Test', password: 'Casey-Test-Pass-77', role: 'viewer' }));
  const caseyId = (made.json as { item: { _id: string } }).item._id;
  add('user create duplicate (other case)', await O('POST', '/admin/users', { username: 'casey.test', password: 'Casey-Test-Pass-77', role: 'viewer' }));
  add('user create weak password', await O('POST', '/admin/users', { username: 'weakling', password: 'short', role: 'viewer' }));
  add('user create bad role', await O('POST', '/admin/users', { username: 'weakling', password: 'Casey-Test-Pass-77', role: 'root' }));
  add('user create extra field', await O('POST', '/admin/users', { username: 'extra1', password: 'Casey-Test-Pass-77', role: 'viewer', disabled: true }));
  add('user create: editor', await E('POST', '/admin/users', { username: 'extra2', password: 'Casey-Test-Pass-77', role: 'viewer' }));
  add('user role change', await O('PATCH', `/admin/users/${caseyId}`, { role: 'editor' }));
  add('user disable', await O('PATCH', `/admin/users/${caseyId}`, { disabled: true }));
  add('user PATCH empty', await O('PATCH', `/admin/users/${caseyId}`, {}));
  add('own role', await O('PATCH', `/admin/users/${me}`, { role: 'viewer' }));
  add('own disable', await O('PATCH', `/admin/users/${me}`, { disabled: true }));
  add('own delete', await O('DELETE', `/admin/users/${me}`));
  add('user delete', await O('DELETE', `/admin/users/${caseyId}`));
  add('user delete again', await O('DELETE', `/admin/users/${caseyId}`));

  // export
  for (const file of ['orders', 'candles', 'contacts', 'payments']) {
    const csv = add(`export ${file}`, await E('GET', `/admin/export/${file}.csv`));
    steps.push({ label: `export ${file} header and type`, status: 0, shape: [csv.text.replace(/^﻿/, '').split('\r\n')[0], csv.headers.get('content-type'), /^attachment; filename="\w+-\d{4}-\d\d-\d\d\.csv"$/.test(csv.headers.get('content-disposition') ?? ''), csv.text.charCodeAt(0) === 0xfeff] });
  }
  add('export payments: unfulfilled only', await E('GET', '/admin/export/payments.csv?status=unfulfilled'));
  add('export payments: bad status', await E('GET', '/admin/export/payments.csv?status=bogus'));
  add('export: viewer', await V('GET', '/admin/export/orders.csv'));
  add('export: unknown file', await O('GET', '/admin/export/users.csv'));

  // account: password, two-factor
  const pc = await signIn(backend, 'passchange', 'Passchange-Mock-Pass-1');
  const P = client(backend, pc.token);
  add('password wrong current', await P('POST', '/admin/auth/password', { currentPassword: 'nope-nope-nope-1', newPassword: 'A-Brand-New-Pass-2026' }));
  add('password too short', await P('POST', '/admin/auth/password', { currentPassword: 'Passchange-Mock-Pass-1', newPassword: 'short' }));
  add('password same', await P('POST', '/admin/auth/password', { currentPassword: 'Passchange-Mock-Pass-1', newPassword: 'Passchange-Mock-Pass-1' }));
  add('password ok', await P('POST', '/admin/auth/password', { currentPassword: 'Passchange-Mock-Pass-1', newPassword: 'A-Brand-New-Pass-2026' }));
  add('password: sign in with the new one', (await signIn(backend, 'passchange', 'A-Brand-New-Pass-2026')).res);

  const ts = await signIn(backend, 'totpsetup', 'Totpsetup-Mock-Pass-1');
  const T = client(backend, ts.token);
  const setup = add('totp setup', await T('POST', '/admin/auth/totp/setup'));
  add('totp setup twice', await T('POST', '/admin/auth/totp/setup'));
  const secret = (setup.json as { secret: string }).secret;
  add('totp enable wrong code', await T('POST', '/admin/auth/totp/enable', { code: '000000' }));
  add('totp enable', await T('POST', '/admin/auth/totp/enable', { code: totpCode(secret, Date.now() - 30_000) }));
  add('login needs the code', (await signIn(backend, 'totpsetup', 'Totpsetup-Mock-Pass-1')).res);
  add('login with the code', (await signIn(backend, 'totpsetup', 'Totpsetup-Mock-Pass-1', { totp: totpCode(secret) })).res);
  add('login with the same code again (replay)', (await signIn(backend, 'totpsetup', 'Totpsetup-Mock-Pass-1', { totp: totpCode(secret) })).res);
  add('login with an older code', (await signIn(backend, 'totpsetup', 'Totpsetup-Mock-Pass-1', { totp: totpCode(secret, Date.now() - 30_000) })).res);

  // sign-in failures: generic message, lock after 5, rate limit
  add('login wrong password', (await signIn(backend, 'owner', 'definitely-wrong-password')).res);
  add('login unknown user', (await signIn(backend, 'nobody-here', 'definitely-wrong-password')).res);
  add('login malformed', await client(backend)('POST', '/admin/auth/login', { username: { $ne: null }, password: 'x' }));
  add('login empty body', await client(backend)('POST', '/admin/auth/login', {}));
  for (let i = 0; i < 5; i += 1) await signIn(backend, 'locktest', `wrong-password-${i}`);
  add('login locked account, right password', (await signIn(backend, 'locktest', 'Locktest-Mock-Pass-1')).res);
  const sameIp = '10.200.0.1';
  let limited = 0;
  for (let i = 0; i < 8; i += 1) {
    const res = await client(backend)('POST', '/admin/auth/login', { username: 'rate-probe', password: 'x'.repeat(12) }, { 'X-Forwarded-For': sameIp });
    if (res.status === 429) { limited = i + 1; add('login rate limited', res); break; }
  }
  steps.push({ label: 'attempts before 429', status: 0, shape: limited });

  // forgotten password: the same neutral answer for every address, a one-time link by e-mail, the policy, one use only
  const forgot = (email: unknown, headers: Record<string, string> = {}) => client(backend)('POST', '/admin/auth/forgot-password', { email }, headers);
  const resetPassword = (body: Record<string, unknown>) => client(backend)('POST', '/admin/auth/reset-password', body);
  const resetMails = async () => (await backend.emails()).filter((m) => /dashboard: (reset|choose) your password/.test(m.subject));
  const linkToken = (text: string) => /\/reset-password\?token=([A-Za-z0-9_-]{43})(?:\s|$)/.exec(text)?.[1] ?? '';
  const errorText = (r: Reply) => (r.json as { error?: string } | null)?.error ?? null;
  const before = await signIn(backend, 'resetpass', 'Resetpass-Mock-Pass-1');
  add('forgot: an account\'s address (any case, spaces)', await forgot('  ResetPass@Example.COM '));
  add('forgot: an unknown address', await forgot('nobody-here@example.com'));
  add('forgot: not an address', await forgot('nope'));
  add('forgot: not text', await forgot({ $ne: null }));
  add('forgot: a username is not an address', await forgot('owner'));
  const mails = await resetMails();
  steps.push({ label: 'forgot: mails sent (to, subject, link shape)', status: 0, shape: mails.map((m) => [m.to, m.subject, linkToken(m.text).length, /Your username: resetpass/.test(m.text)]) });
  const token = linkToken(mails.at(-1)?.text ?? '');
  const NEW = 'A-Fresh-Reset-Pass-2026';
  for (const [label, body] of Object.entries({
    'an unknown token': { token: 'A'.repeat(43), password: NEW },
    'a malformed token': { token: 'short', password: NEW },
    'no token': { password: NEW },
    'no password': { token },
    'a short password': { token, password: 'short' },
    'the username': { token, password: 'Resetpass-123' },
    'a common password': { token, password: 'password1234' },
    'a repetitive password': { token, password: 'abababababab' },
  })) {
    const r = add(`reset: ${label}`, await resetPassword(body));
    steps.push({ label: `reset: ${label} (text)`, status: 0, shape: errorText(r) });
  }
  add('reset: ok', await resetPassword({ token, password: NEW }));
  const again = add('reset: the same link again', await resetPassword({ token, password: `${NEW}-2` }));
  steps.push({ label: 'reset: the same link again (text)', status: 0, shape: errorText(again) });
  add('reset: the session from before ended', await client(backend, before.token)('GET', '/admin/auth/me'));
  add('reset: the old password fails', (await signIn(backend, 'resetpass', 'Resetpass-Mock-Pass-1')).res);
  add('reset: sign in with the new password', (await signIn(backend, 'resetpass', NEW)).res);
  let forgotLimited = 0;
  for (let i = 0; i < 6; i += 1) {
    const res = await forgot('rate.probe@example.com', { 'X-Forwarded-For': '10.201.0.1' });
    if (res.status === 429) { forgotLimited = i + 1; add('forgot rate limited', res); break; }
  }
  steps.push({ label: 'forgot: requests before 429 (one address and e-mail)', status: 0, shape: forgotLimited });
  let resetLimited = 0;
  for (let i = 0; i < 14; i += 1) {
    const res = await client(backend)('POST', '/admin/auth/reset-password', { token: 'B'.repeat(43), password: NEW }, { 'X-Forwarded-For': '10.202.0.1' });
    if (res.status === 429) { resetLimited = i + 1; add('reset rate limited', res); break; }
  }
  steps.push({ label: 'reset: failures before 429', status: 0, shape: resetLimited });

  // sessions and roles
  add('no token', await client(backend)('GET', '/admin/orders'));
  add('bad token', await client(backend, 'abc.def.ghi')('GET', '/admin/orders'));
  add('viewer: users', await V('GET', '/admin/users'));
  add('viewer: audit', await V('GET', '/admin/audit'));
  add('editor: users', await E('GET', '/admin/users'));
  add('unknown route', await O('GET', '/admin/nothing-here'));
  add('logout', await V('POST', '/admin/auth/logout'));
  add('token after logout', await V('GET', '/admin/auth/me'));

  // the first owner: while NO account exists, a request for the owner's address creates it and mails the link
  await backend.reset({ accounts: false });
  const OWNER_EMAIL = 'nazarethholycross@gmail.com';
  add('bootstrap: another address', await forgot('someone@example.com'));
  steps.push({ label: 'bootstrap: no mail for another address', status: 0, shape: (await resetMails()).length });
  add('bootstrap: the owner\'s address', await forgot(' NazarethHolyCross@gmail.com '));
  const first = await resetMails();
  steps.push({ label: 'bootstrap: the mail', status: 0, shape: first.map((m) => [m.to, m.subject, /Your username: nazarethholycross@gmail\.com/.test(m.text)]) });
  add('bootstrap: choose the password', await resetPassword({ token: linkToken(first.at(-1)?.text ?? ''), password: 'Olive-Courtyard-Lamp-77' }));
  const ownerLogin = add('bootstrap: sign in with the address as the username', (await signIn(backend, OWNER_EMAIL, 'Olive-Courtyard-Lamp-77')).res);
  steps.push({ label: 'bootstrap: the role', status: 0, shape: (ownerLogin.json as { user?: { role?: string } } | null)?.user?.role ?? null });
  add('bootstrap: a second request (the account exists now)', await forgot(OWNER_EMAIL));
  steps.push({ label: 'bootstrap: mail subjects', status: 0, shape: (await resetMails()).map((m) => m.subject) });
  return { steps, replies };
}

// ---- the tests

describe.skipIf(!haveServer)('the mock and the real API agree (status codes and shapes)', () => {
  let a: Awaited<ReturnType<typeof scenario>>;
  let b: Awaited<ReturnType<typeof scenario>>;
  beforeAll(async () => {
    a = await scenario(mock);
    b = await scenario(real);
  }, 120_000);

  it('runs the same script and every step answers the same status', () => {
    expect(b.steps.map((s) => s.label)).toEqual(a.steps.map((s) => s.label));
    const differing = a.steps.filter((s, i) => s.status !== b.steps[i].status).map((s) => `${s.label}: mock ${s.status}, real ${b.steps.find((x) => x.label === s.label)?.status}`);
    expect(differing).toEqual([]);
  });

  it('every answer has the same shape (keys and types)', () => {
    const paths = (value: unknown, prefix = ''): string[] => {
      if (Array.isArray(value)) return value.length ? paths(value[0], `${prefix}[]`) : [`${prefix}[]=empty`];
      if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => paths(v, `${prefix}.${k}`));
      return [`${prefix}:${String(value).replace(/^null\|/, '').replace(/\|null$/, '')}`]; // "number|null" (sometimes empty) counts as number
    };
    const differing = a.steps.flatMap((s, i) => {
      const left = new Set(paths(s.shape));
      const right = new Set(paths(b.steps[i].shape));
      const emptyOn = (set: Set<string>) => [...set].filter((p) => p.endsWith('[]=empty')).map((p) => p.replace('=empty', ''));
      const covered = (p: string, empties: string[]) => empties.some((e) => p.startsWith(e));
      const onlyMock = [...left].filter((p) => !right.has(p) && !p.endsWith('[]=empty') && !covered(p, emptyOn(right)));
      const onlyReal = [...right].filter((p) => !left.has(p) && !p.endsWith('[]=empty') && !covered(p, emptyOn(left)));
      return onlyMock.length || onlyReal.length ? [`${s.label}: only mock ${JSON.stringify(onlyMock)} / only real ${JSON.stringify(onlyReal)}`] : [];
    });
    expect(differing).toEqual([]);
  });

  it('the dashboard\'s own schemas accept what the REAL API sends', () => {
    const r = b.replies;
    const parse = (label: string, schema: { safeParse(v: unknown): { success: boolean; error?: unknown } }) => {
      const result = schema.safeParse(r[label].json);
      expect(result.success, `${label}: ${JSON.stringify((result as { error?: { issues?: unknown } }).error?.issues ?? '').slice(0, 300)}`).toBe(true);
    };
    parse('login', loginResponseSchema);
    parse('me', meSchema);
    parse('dashboard', dashboardSchema);
    parse('list orders', ordersPage);
    parse('list candles', candlesPage);
    parse('list contacts', contactsPage);
    parse('list site-reviews', siteReviewsPage);
    parse('list product-reviews', productReviewsPage);
    parse('list prayers', prayersPage);
    parse('list products', productsPage);
    parse('list users', usersPage);
    parse('list audit', auditPage);
    parse('list payments', paymentsPage);
    parse('privacy lookup', privacyLookupSchema);
    parse('privacy erase', privacyEraseSchema);
    parse('detail products', productSchema);
    parse('totp setup', totpSetupSchema);
    parse('live state (nothing yet)', liveStateSchema);
    parse('live state (live)', liveStateSchema);
    parse('live start', liveStartSchema);
    parse('live stop', liveStopSchema);
    parse('live stop again', liveStopSchema);
  });

  it('and so do the mock\'s answers (the mock is what the dashboard\'s own end-to-end run sees)', () => {
    const r = a.replies;
    for (const [label, schema] of Object.entries({ login: loginResponseSchema, me: meSchema, dashboard: dashboardSchema, 'list orders': ordersPage, 'list users': usersPage, 'list audit': auditPage, 'list products': productsPage, 'list payments': paymentsPage })) {
      expect(schema.safeParse(r[label].json).success, label).toBe(true);
    }
  });
});
