// Local mock of the admin API contract (docs/ADMIN.md). Plain node:http, no dependencies, deterministic seed data.
//
//   npm run dev:mock            -> http://localhost:3902
//   MOCK_PORT=3902 MOCK_LOGIN_LIMIT=8 MOCK_TOKEN_TTL=3600 node mock-api/server.mjs
//
// It implements every route of the contract, including account lockout, the login rate limit, TOTP, role checks,
// session revocation and the audit log. It is for development and tests only: the passwords below are public.
import http from 'node:http';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { toCsv } from './csv.mjs';
import { buildSeed, hashPassword, MOCK_USERS, newId } from './seed.mjs';
import { generateSecret, otpauthUrl, verifyTotp } from './totp.mjs';

const PORT = Number(process.env.MOCK_PORT ?? 3902);
const JWT_SECRET = process.env.MOCK_JWT_SECRET ?? 'mock-jwt-secret-for-local-development-only';
const TOKEN_TTL = Number(process.env.MOCK_TOKEN_TTL ?? 3600);
const LOGIN_LIMIT = Number(process.env.MOCK_LOGIN_LIMIT ?? 8); // the contract says 5; see README (lockout is 5, so it stays visible)
const LOGIN_WINDOW_MS = Number(process.env.MOCK_LOGIN_WINDOW_MS ?? 15 * 60_000);
const LOCK_MS = Number(process.env.MOCK_LOCK_MS ?? 15 * 60_000);
const ASSET_BASE = process.env.MOCK_ASSET_BASE ?? 'http://localhost:3901';
const ADMIN_ORIGINS = (process.env.ADMIN_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const IP_SALT = 'mock-ip-salt';
const ROLES = ['owner', 'editor', 'viewer'];
const COMMON_PASSWORDS = new Set(['password1234', 'password12345', 'passw0rd1234', '123456789012', 'qwertyuiop12', 'letmein12345', 'administrator', 'welcome12345']);

// ------------------------------------------------------------------ state

let db;
let emails;
let revoked;
let sessions;
let audit;
let failures;
let attempts;
let rateBuckets;

function reset() {
  const seed = buildSeed(Date.now(), ASSET_BASE);
  db = {
    ...seed,
    users: MOCK_USERS.map((u) => {
      const { salt, hash } = hashPassword(u.password);
      return {
        _id: newId('7'),
        username: u.username,
        role: u.role,
        disabled: false,
        salt,
        hash,
        totpSecret: u.totpSecret ?? null,
        pendingTotp: null,
        lastLoginAt: null,
        createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
      };
    }),
  };
  emails = [];
  revoked = new Set();
  sessions = new Map(); // sid -> user id
  audit = [];
  failures = new Map(); // user id -> { count, lockedUntil }
  attempts = new Map(); // "ip|username" -> [timestamps]
  rateBuckets = new Map();
}
reset();

// ------------------------------------------------------------------ helpers

const b64u = (buf) => Buffer.from(buf).toString('base64url');

function signJwt(payload) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function verifyJwt(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function checkPassword(user, password) {
  const candidate = scryptSync(String(password), user.salt, 32);
  return timingSafeEqual(candidate, user.hash);
}

// A dummy hash so an unknown username takes as long as a wrong password.
const DUMMY = hashPassword('dummy-password-for-timing');

function passwordProblem(password, username) {
  if (typeof password !== 'string' || password.length < 12) return 'Password must be at least 12 characters.';
  if (password.length > 200) return 'Password is too long.';
  if (password.toLowerCase() === String(username).toLowerCase()) return 'Password must not equal the username.';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'That password is too common.';
  return null;
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim() || 'unknown';
}

function uaSummary(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /node|undici/i.test(ua) ? 'Script' : 'Other';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

function record(req, action, target, meta, actor = req.auth?.user) {
  audit.unshift({
    _id: newId('6'),
    createdAt: new Date().toISOString(),
    actor: actor?.username ?? 'anonymous',
    actorId: actor?._id ?? null,
    action,
    target: target ?? '',
    meta: meta ?? null,
    ipHash: createHash('sha256').update(IP_SALT + clientIp(req)).digest('hex').slice(0, 16),
    userAgent: uaSummary(String(req.headers['user-agent'] ?? '')),
  });
  if (audit.length > 2000) audit.length = 2000;
}

class HttpError extends Error {
  constructor(status, message, headers) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function send(req, res, status, body, extra = {}) {
  const origin = req.headers.origin;
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Type': 'application/json; charset=utf-8',
    ...(origin && ADMIN_ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } : {}),
    ...extra,
  };
  res.writeHead(status, headers);
  res.end(status === 204 ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!size) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
      } catch {
        reject(new HttpError(400, 'Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function authenticate(req) {
  const header = String(req.headers.authorization ?? '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = token ? verifyJwt(token) : null;
  if (!claims || revoked.has(claims.sid)) throw new HttpError(401, 'Unauthorized');
  const user = db.users.find((u) => u._id === claims.sub);
  if (!user || user.disabled) throw new HttpError(401, 'Unauthorized');

  const bucket = rateBuckets.get(user._id) ?? { start: Date.now(), count: 0 };
  if (Date.now() - bucket.start > 15 * 60_000) Object.assign(bucket, { start: Date.now(), count: 0 });
  bucket.count += 1;
  rateBuckets.set(user._id, bucket);
  if (bucket.count > 300) throw new HttpError(429, 'Too many requests', { 'Retry-After': '60' });

  req.auth = { user, sid: claims.sid, exp: claims.exp };
}

function requireRole(req, roles) {
  if (!roles.includes(req.auth.user.role)) throw new HttpError(403, 'Forbidden');
}

const WRITE = ['owner', 'editor'];
const OWNER = ['owner'];

function publicUser(u) {
  return { _id: u._id, id: u._id, username: u.username, role: u.role, disabled: u.disabled, totpEnabled: Boolean(u.totpSecret), lastLoginAt: u.lastLoginAt, createdAt: u.createdAt };
}

// ------------------------------------------------------------------ lists

function paginate(url, rows, { searchable, statusOf, sorts, defaultSort = '-createdAt' }) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const size = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('size') ?? '25', 10) || 25));
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 100);
  const status = url.searchParams.get('status') ?? '';
  const sort = url.searchParams.get('sort') || defaultSort;
  let list = rows;
  if (q) list = list.filter((row) => searchable(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
  if (status && statusOf) list = list.filter((row) => statusOf(row) === status);
  const desc = sort.startsWith('-');
  const key = desc ? sort.slice(1) : sort;
  if (sorts.includes(key)) {
    list = [...list].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return desc ? -cmp : cmp;
    });
  }
  return { items: list.slice((page - 1) * size, page * size), total: list.length, page, size };
}

const byId = (rows, id) => rows.find((r) => r._id === id);

function simpleResource({ name, rowsOf, searchable, statusOf, sorts, doneField, patchable, deleteRoles = WRITE, label }) {
  const routes = [];
  routes.push({ method: 'GET', path: `/admin/${name}`, roles: ROLES, run: (ctx) => paginate(ctx.url, rowsOf(), { searchable, statusOf, sorts }) });
  routes.push({
    method: 'GET', path: `/admin/${name}/:id`, roles: ROLES,
    run: (ctx) => byId(rowsOf(), ctx.params.id) ?? (() => { throw new HttpError(404, `${label} not found`); })(),
  });
  if (patchable) {
    routes.push({
      method: 'PATCH', path: `/admin/${name}/:id`, roles: WRITE,
      run: (ctx) => {
        const row = byId(rowsOf(), ctx.params.id) ?? (() => { throw new HttpError(404, `${label} not found`); })();
        const field = doneField;
        if (typeof ctx.body[field] !== 'boolean') throw new HttpError(400, `${field} must be true or false`);
        row[field] = ctx.body[field];
        if (name === 'orders' && field === 'done' && row.done) {
          emails.push({ to: row.email, subject: 'Your order has been shipped', orderId: row._id, at: new Date().toISOString() });
        }
        record(ctx.req, `${label.toLowerCase().replace(' ', '-')}.update`, row._id, { [field]: row[field] });
        return row;
      },
    });
  }
  routes.push({
    method: 'DELETE', path: `/admin/${name}/:id`, roles: deleteRoles,
    run: (ctx) => {
      const list = rowsOf();
      const index = list.findIndex((r) => r._id === ctx.params.id);
      if (index < 0) throw new HttpError(404, `${label} not found`);
      list.splice(index, 1);
      record(ctx.req, `${label.toLowerCase().replace(' ', '-')}.delete`, ctx.params.id);
      return 204;
    },
  });
  return routes;
}

// ------------------------------------------------------------------ products

function validateProduct(body, partial = false) {
  const out = {};
  const need = (cond, message) => { if (!cond) throw new HttpError(400, message); };
  const has = (k) => body[k] !== undefined;
  if (!partial || has('name')) {
    need(typeof body.name === 'string' && body.name.trim().length >= 2 && body.name.trim().length <= 200, 'Name must be 2 to 200 characters');
    out.name = body.name.trim();
  }
  if (!partial || has('price')) {
    need(typeof body.price === 'number' && body.price >= 0.01 && body.price <= 10_000, 'Price must be between 0.01 and 10000');
    out.price = Math.round(body.price * 100) / 100;
  }
  if (!partial || has('img')) {
    need(typeof body.img === 'string' && /^https?:\/\/[^\s]+$/.test(body.img) && body.img.length <= 1000, 'Main image must be a URL');
    out.img = body.img;
  }
  if (has('additionalImageUrls')) {
    need(Array.isArray(body.additionalImageUrls) && body.additionalImageUrls.length <= 5 && body.additionalImageUrls.every((u) => typeof u === 'string' && /^https?:\/\/[^\s]+$/.test(u)), 'Up to 5 additional image URLs');
    out.additionalImageUrls = body.additionalImageUrls;
  }
  if (has('description')) {
    need(typeof body.description === 'string' && body.description.length <= 2000, 'Description is too long');
    out.description = body.description.trim();
  }
  if (has('uuidv4_')) {
    need(typeof body.uuidv4_ === 'string' && body.uuidv4_.length <= 60, 'Bad uuidv4_');
    out.uuidv4_ = body.uuidv4_;
  }
  if (has('rate')) {
    need(typeof body.rate === 'number' && body.rate >= 0 && body.rate <= 5, 'Featured weight must be between 0 and 5');
    out.rate = body.rate;
  }
  if (has('color')) {
    need(Array.isArray(body.color) && body.color.length <= 12 && body.color.every((c) => typeof c === 'string' && c.length <= 40), 'Colours must be a short list of names');
    out.color = body.color.map((c) => c.trim()).filter(Boolean);
  }
  if (has('stock')) {
    need(body.stock === null || (Number.isInteger(body.stock) && body.stock >= 0 && body.stock <= 1_000_000), 'Stock must be a whole number, or empty for unlimited');
    out.stock = body.stock;
  }
  if (has('category')) {
    need(body.category === null || (typeof body.category === 'string' && body.category.length <= 60), 'Category is too long');
    out.category = body.category;
  }
  return out;
}

// ------------------------------------------------------------------ dashboard

function dashboard() {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const days = [];
  for (let i = 29; i >= 0; i -= 1) days.push(new Date(todayUtc.getTime() - i * 86_400_000).toISOString().slice(0, 10));
  const map = new Map(days.map((d) => [d, { date: d, orders: 0, revenue: 0, candles: 0 }]));
  for (const o of db.orders) { const e = map.get(String(o.createdAt).slice(0, 10)); if (e) { e.orders += 1; e.revenue = Math.round((e.revenue + o.totalPrice) * 100) / 100; } }
  for (const c of db.candles) { const e = map.get(String(c.createdAt).slice(0, 10)); if (e) e.candles += 1; }

  const sold = new Map();
  for (const o of db.orders) {
    for (const l of o.products) {
      const key = String(l.productID ?? l.productName);
      const product = db.products.find((p) => p._id === l.productID);
      const cur = sold.get(key) ?? { productId: l.productID ?? null, name: l.productName ?? product?.name ?? 'Unknown', sold: 0, revenue: 0 };
      cur.sold += l.quantity;
      cur.revenue = Math.round((cur.revenue + l.quantity * (product?.price ?? 0)) * 100) / 100;
      sold.set(key, cur);
    }
  }
  const newest = (rows) => [...rows].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5);
  return {
    totals: {
      orders: db.orders.length,
      ordersPending: db.orders.filter((o) => !o.done).length,
      revenue: Math.round(db.orders.reduce((s, o) => s + o.totalPrice, 0) * 100) / 100,
      candles: db.candles.length,
      candlesPending: db.candles.filter((c) => !c.done).length,
      contacts: db.contacts.length,
      contactsOpen: db.contacts.filter((c) => !c.done).length,
      products: db.products.length,
      productReviews: db.productReviews.length,
      prayers: db.prayers.length,
      reviews: db.siteReviews.length,
    },
    last30Days: days.map((d) => map.get(d)),
    topProducts: [...sold.values()].sort((a, b) => b.sold - a.sold).slice(0, 5),
    lowStock: db.products.filter((p) => typeof p.stock === 'number' && p.stock <= 5).sort((a, b) => a.stock - b.stock).map((p) => ({ productId: p._id, name: p.name, stock: p.stock })),
    recent: { orders: newest(db.orders), candles: newest(db.candles), contacts: newest(db.contacts) },
  };
}

// ------------------------------------------------------------------ routes

const routes = [];
const add = (route) => routes.push(route);

// --- auth
add({
  method: 'POST', path: '/admin/auth/login', public: true,
  run: async (ctx) => {
    const { username, password, totp } = ctx.body;
    const ip = clientIp(ctx.req);
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password || username.length > 100 || password.length > 200) throw new HttpError(401, 'Invalid credentials');

    // Rate limit per IP + username.
    const key = `${ip}|${username.toLowerCase()}`;
    const now = Date.now();
    const recent = (attempts.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
    if (recent.length >= LOGIN_LIMIT) {
      const wait = Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (now - recent[0])) / 1000));
      throw new HttpError(429, 'Too many attempts', { 'Retry-After': String(wait) });
    }
    recent.push(now);
    attempts.set(key, recent);

    const user = db.users.find((u) => u.username === username);
    const ok = checkPassword(user ?? DUMMY, password) && Boolean(user);
    const fail = failures.get(user?._id) ?? { count: 0, lockedUntil: 0 };

    const lockedNow = user && fail.lockedUntil > now;
    if (!ok || lockedNow || user.disabled) {
      if (user && !lockedNow) {
        fail.count += 1;
        if (fail.count >= 5) fail.lockedUntil = now + LOCK_MS;
        failures.set(user._id, fail);
      }
      record(ctx.req, 'auth.login_failed', username, null, { username });
      throw new HttpError(401, 'Invalid credentials');
    }

    if (user.totpSecret) {
      const wellFormed = typeof totp === 'string' && /^\d{6}$/.test(totp.trim());
      if (!wellFormed) throw new HttpError(428, 'totp_required');
      if (!verifyTotp(user.totpSecret, totp)) {
        fail.count += 1;
        if (fail.count >= 5) fail.lockedUntil = now + LOCK_MS;
        failures.set(user._id, fail);
        record(ctx.req, 'auth.login_failed', username, { step: 'totp' }, { username });
        throw new HttpError(401, 'Invalid credentials');
      }
    }

    failures.delete(user._id);
    attempts.delete(key);
    user.lastLoginAt = new Date().toISOString();
    const sid = randomBytes(12).toString('hex');
    sessions.set(sid, user._id);
    const iat = Math.floor(now / 1000);
    const token = signJwt({ sub: user._id, role: user.role, sid, iat, exp: iat + TOKEN_TTL });
    record(ctx.req, 'auth.login', username, null, user);
    return { token, expiresIn: TOKEN_TTL, user: { id: user._id, username: user.username, role: user.role, totpEnabled: Boolean(user.totpSecret) } };
  },
});

add({
  method: 'POST', path: '/admin/auth/logout', roles: ROLES,
  run: (ctx) => {
    revoked.add(ctx.req.auth.sid);
    record(ctx.req, 'auth.logout', ctx.req.auth.user.username);
    return 204;
  },
});

add({
  method: 'GET', path: '/admin/auth/me', roles: ROLES,
  run: (ctx) => {
    const u = ctx.req.auth.user;
    return { id: u._id, username: u.username, role: u.role, totpEnabled: Boolean(u.totpSecret), lastLoginAt: u.lastLoginAt };
  },
});

add({
  method: 'POST', path: '/admin/auth/password', roles: ROLES,
  run: (ctx) => {
    const u = ctx.req.auth.user;
    const { currentPassword, newPassword } = ctx.body;
    if (typeof currentPassword !== 'string' || !checkPassword(u, currentPassword)) throw new HttpError(400, 'Current password is wrong');
    const problem = passwordProblem(newPassword, u.username);
    if (problem) throw new HttpError(400, problem);
    const { salt, hash } = hashPassword(newPassword);
    Object.assign(u, { salt, hash });
    for (const [sid, uid] of sessions) if (uid === u._id && sid !== ctx.req.auth.sid) revoked.add(sid);
    record(ctx.req, 'auth.password', u.username);
    return 204;
  },
});

add({
  method: 'POST', path: '/admin/auth/totp/setup', roles: ROLES,
  run: (ctx) => {
    const u = ctx.req.auth.user;
    if (u.totpSecret) throw new HttpError(409, 'Two-factor sign-in is already on');
    u.pendingTotp = generateSecret();
    record(ctx.req, 'totp.setup', u.username);
    return { secret: u.pendingTotp, otpauthUrl: otpauthUrl(u.pendingTotp, u.username) };
  },
});

add({
  method: 'POST', path: '/admin/auth/totp/enable', roles: ROLES,
  run: (ctx) => {
    const u = ctx.req.auth.user;
    if (!u.pendingTotp) throw new HttpError(400, 'Start the setup first');
    if (!verifyTotp(u.pendingTotp, ctx.body.code)) throw new HttpError(400, 'That code is not right');
    u.totpSecret = u.pendingTotp;
    u.pendingTotp = null;
    record(ctx.req, 'totp.enable', u.username);
    return 204;
  },
});

add({
  method: 'POST', path: '/admin/auth/totp/disable', roles: ROLES,
  run: (ctx) => {
    const u = ctx.req.auth.user;
    if (!u.totpSecret) throw new HttpError(400, 'Two-factor sign-in is not on');
    if (typeof ctx.body.password !== 'string' || !checkPassword(u, ctx.body.password) || !verifyTotp(u.totpSecret, ctx.body.code)) throw new HttpError(400, 'Password or code is not right');
    u.totpSecret = null;
    record(ctx.req, 'totp.disable', u.username);
    return 204;
  },
});

// --- dashboard
add({ method: 'GET', path: '/admin/dashboard', roles: ROLES, run: () => dashboard() });

// --- resources
for (const route of simpleResource({
  name: 'orders', label: 'Order', rowsOf: () => db.orders, doneField: 'done', patchable: true, deleteRoles: OWNER,
  searchable: (o) => [o._id, o.firstName, o.lastName, o.email, o.city, o.country, o.phone],
  statusOf: (o) => (o.done ? 'shipped' : 'pending'), sorts: ['createdAt', 'totalPrice', 'lastName'],
})) add(route);
for (const route of simpleResource({
  name: 'candles', label: 'Candle', rowsOf: () => db.candles, doneField: 'done', patchable: true,
  searchable: (c) => [c.firstName, c.lastName, c.email, c.prayer], statusOf: (c) => (c.done ? 'done' : 'pending'), sorts: ['createdAt', 'lastName'],
})) add(route);
for (const route of simpleResource({
  name: 'contacts', label: 'Contact', rowsOf: () => db.contacts, doneField: 'done', patchable: true,
  searchable: (c) => [c.fullName, c.email, c.msg, c.phone], statusOf: (c) => (c.done ? 'done' : 'pending'), sorts: ['createdAt', 'fullName'],
})) add(route);
for (const route of simpleResource({
  name: 'site-reviews', label: 'Review', rowsOf: () => db.siteReviews, doneField: 'approved', patchable: true,
  searchable: (r) => [r.fullName, r.email, r.msg], statusOf: (r) => (r.approved ? 'approved' : 'hidden'), sorts: ['createdAt', 'fullName'],
})) add(route);
for (const route of simpleResource({
  name: 'product-reviews', label: 'Product review', rowsOf: () => db.productReviews, doneField: 'approved', patchable: true,
  searchable: (r) => [r.name, r.comment, r.title, r.product?.name], statusOf: (r) => (r.approved ? 'approved' : 'hidden'), sorts: ['createdAt', 'rating'],
})) add(route);
for (const route of simpleResource({
  name: 'prayers', label: 'Prayer', rowsOf: () => db.prayers, patchable: false,
  searchable: (p) => [p.name, p.country, p.prayer, p.category], sorts: ['createdAt', 'likes', 'name'],
})) add(route);

// --- products
add({ method: 'GET', path: '/admin/products', roles: ROLES, run: (ctx) => paginate(ctx.url, db.products, { searchable: (p) => [p.name, p.description, p.category], statusOf: (p) => (p.stock === 0 ? 'out' : typeof p.stock === 'number' && p.stock <= 5 ? 'low' : 'ok'), sorts: ['createdAt', 'name', 'price', 'stock', 'rate'] }) });
add({ method: 'GET', path: '/admin/products/:id', roles: ROLES, run: (ctx) => byId(db.products, ctx.params.id) ?? (() => { throw new HttpError(404, 'Product not found'); })() });
add({
  method: 'POST', path: '/admin/products', roles: WRITE,
  run: (ctx) => {
    const data = validateProduct(ctx.body);
    const product = { _id: newId('b'), additionalImageUrls: [], description: '', color: [], rate: 1, stock: null, category: null, ...data, createdAt: new Date().toISOString() };
    db.products.unshift(product);
    record(ctx.req, 'product.create', product._id, { name: product.name });
    return { status: 201, body: product };
  },
});
add({
  method: 'PUT', path: '/admin/products/:id', roles: WRITE,
  run: (ctx) => {
    const product = byId(db.products, ctx.params.id) ?? (() => { throw new HttpError(404, 'Product not found'); })();
    Object.assign(product, validateProduct(ctx.body, true));
    record(ctx.req, 'product.update', product._id, { name: product.name });
    return product;
  },
});
add({
  method: 'PATCH', path: '/admin/products/:id', roles: WRITE,
  run: (ctx) => {
    const product = byId(db.products, ctx.params.id) ?? (() => { throw new HttpError(404, 'Product not found'); })();
    Object.assign(product, validateProduct(ctx.body, true));
    record(ctx.req, 'product.update', product._id, { name: product.name });
    return product;
  },
});
add({
  method: 'DELETE', path: '/admin/products/:id', roles: WRITE,
  run: (ctx) => {
    const index = db.products.findIndex((p) => p._id === ctx.params.id);
    if (index < 0) throw new HttpError(404, 'Product not found');
    db.products.splice(index, 1);
    record(ctx.req, 'product.delete', ctx.params.id);
    return 204;
  },
});

// --- export
const EXPORTS = {
  orders: { rows: () => db.orders, cols: [
    { header: 'Order', value: (o) => o._id }, { header: 'Date', value: (o) => o.createdAt }, { header: 'First name', value: (o) => o.firstName }, { header: 'Last name', value: (o) => o.lastName },
    { header: 'Email', value: (o) => o.email }, { header: 'Phone', value: (o) => o.phone }, { header: 'Country', value: (o) => o.country }, { header: 'Total', value: (o) => o.totalPrice },
    { header: 'Items', value: (o) => o.products.map((p) => `${p.quantity} x ${p.productName}`).join('; ') }, { header: 'Shipped', value: (o) => (o.done ? 'yes' : 'no') },
  ] },
  candles: { rows: () => db.candles, cols: [
    { header: 'Date', value: (c) => c.createdAt }, { header: 'First name', value: (c) => c.firstName }, { header: 'Last name', value: (c) => c.lastName }, { header: 'Email', value: (c) => c.email },
    { header: 'Prayer', value: (c) => c.prayer }, { header: 'Done', value: (c) => (c.done ? 'yes' : 'no') },
  ] },
  contacts: { rows: () => db.contacts, cols: [
    { header: 'Date', value: (c) => c.createdAt }, { header: 'Name', value: (c) => c.fullName }, { header: 'Email', value: (c) => c.email }, { header: 'Phone', value: (c) => c.phone },
    { header: 'Message', value: (c) => c.msg }, { header: 'Done', value: (c) => (c.done ? 'yes' : 'no') },
  ] },
};
add({
  method: 'GET', path: '/admin/export/:file', roles: ROLES,
  run: (ctx) => {
    const match = /^(orders|candles|contacts)\.csv$/.exec(ctx.params.file);
    if (!match) throw new HttpError(404, 'Not found');
    const spec = EXPORTS[match[1]];
    record(ctx.req, 'export.csv', match[1], { rows: spec.rows().length });
    return { status: 200, raw: toCsv(spec.cols, spec.rows()), headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${match[1]}.csv"` } };
  },
});

// --- users
const ownerCount = () => db.users.filter((u) => u.role === 'owner' && !u.disabled).length;
add({ method: 'GET', path: '/admin/users', roles: OWNER, run: (ctx) => { const r = paginate(ctx.url, db.users.map(publicUser), { searchable: (u) => [u.username, u.role], statusOf: (u) => (u.disabled ? 'disabled' : 'active'), sorts: ['username', 'createdAt', 'role'], defaultSort: 'username' }); return r; } });
add({
  method: 'POST', path: '/admin/users', roles: OWNER,
  run: (ctx) => {
    const { username, password, role } = ctx.body;
    if (typeof username !== 'string' || !/^[a-z0-9._-]{3,40}$/.test(username)) throw new HttpError(400, 'Username: 3 to 40 lowercase letters, digits, dot, dash or underscore');
    if (!ROLES.includes(role)) throw new HttpError(400, 'Unknown role');
    const problem = passwordProblem(password, username);
    if (problem) throw new HttpError(400, problem);
    if (db.users.some((u) => u.username === username)) throw new HttpError(409, 'That username is taken');
    const { salt, hash } = hashPassword(password);
    const user = { _id: newId('7'), username, role, disabled: false, salt, hash, totpSecret: null, pendingTotp: null, lastLoginAt: null, createdAt: new Date().toISOString() };
    db.users.push(user);
    record(ctx.req, 'user.create', username, { role });
    return { status: 201, body: publicUser(user) };
  },
});
add({
  method: 'PATCH', path: '/admin/users/:id', roles: OWNER,
  run: (ctx) => {
    const user = byId(db.users, ctx.params.id) ?? (() => { throw new HttpError(404, 'User not found'); })();
    const self = user._id === ctx.req.auth.user._id;
    const { role, disabled } = ctx.body;
    if (role !== undefined) {
      if (!ROLES.includes(role)) throw new HttpError(400, 'Unknown role');
      if (user.role === 'owner' && role !== 'owner' && ownerCount() <= 1) throw new HttpError(409, 'There must be at least one owner');
      if (self && role !== user.role) throw new HttpError(409, 'You cannot change your own role');
    }
    if (disabled !== undefined) {
      if (typeof disabled !== 'boolean') throw new HttpError(400, 'disabled must be true or false');
      if (disabled && self) throw new HttpError(409, 'You cannot disable yourself');
      if (disabled && user.role === 'owner' && ownerCount() <= 1) throw new HttpError(409, 'There must be at least one owner');
    }
    if (role !== undefined) user.role = role;
    if (disabled !== undefined) {
      user.disabled = disabled;
      if (disabled) for (const [sid, uid] of sessions) if (uid === user._id) revoked.add(sid);
    }
    record(ctx.req, 'user.update', user.username, { role, disabled });
    return publicUser(user);
  },
});
add({
  method: 'DELETE', path: '/admin/users/:id', roles: OWNER,
  run: (ctx) => {
    const index = db.users.findIndex((u) => u._id === ctx.params.id);
    if (index < 0) throw new HttpError(404, 'User not found');
    const user = db.users[index];
    if (user._id === ctx.req.auth.user._id) throw new HttpError(409, 'You cannot delete yourself');
    if (user.role === 'owner' && ownerCount() <= 1) throw new HttpError(409, 'There must be at least one owner');
    db.users.splice(index, 1);
    for (const [sid, uid] of sessions) if (uid === user._id) revoked.add(sid);
    record(ctx.req, 'user.delete', user.username);
    return 204;
  },
});

// --- audit
add({
  method: 'GET', path: '/admin/audit', roles: OWNER,
  run: (ctx) => {
    const actor = (ctx.url.searchParams.get('actor') ?? '').toLowerCase();
    const action = (ctx.url.searchParams.get('action') ?? '').toLowerCase();
    const rows = audit.filter((e) => (!actor || e.actor.toLowerCase().includes(actor)) && (!action || e.action.toLowerCase().includes(action)));
    return paginate(ctx.url, rows, { searchable: (e) => [e.actor, e.action, e.target], sorts: ['createdAt'] });
  },
});

// --- test controls (never part of the real API)
const CONTROL = process.env.MOCK_CONTROL !== '0';

// ------------------------------------------------------------------ server

function compile(path) {
  const names = [];
  const pattern = path.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; });
  return { regex: new RegExp(`^${pattern}$`), names };
}
const compiled = routes.map((r) => ({ ...r, ...compile(r.path) }));

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://mock');
  try {
    if (req.method === 'OPTIONS') return send(req, res, 204, null);

    if (CONTROL && url.pathname.startsWith('/__mock/')) {
      if (req.method === 'POST' && url.pathname === '/__mock/reset') { reset(); return send(req, res, 200, { ok: true }); }
      if (req.method === 'GET' && url.pathname === '/__mock/emails') return send(req, res, 200, emails);
      if (req.method === 'GET' && url.pathname === '/__mock/health') return send(req, res, 200, { ok: true });
      return send(req, res, 404, { error: 'Not found' });
    }

    let route;
    let match;
    for (const r of compiled) {
      if (r.method !== req.method) continue;
      match = r.regex.exec(url.pathname);
      if (match) { route = r; break; }
    }
    if (!route) {
      const other = compiled.some((r) => r.regex.test(url.pathname));
      throw new HttpError(other ? 405 : 404, other ? 'Method not allowed' : 'Not found');
    }

    const params = {};
    route.names.forEach((n, i) => { params[n] = decodeURIComponent(match[i + 1]); });
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};

    if (!route.public) {
      authenticate(req);
      requireRole(req, route.roles);
    }
    const result = await route.run({ req, url, params, body });
    if (result === 204) return send(req, res, 204, null);
    if (result && typeof result === 'object' && 'raw' in result) return send(req, res, result.status ?? 200, result.raw, result.headers);
    if (result && typeof result === 'object' && 'status' in result && 'body' in result) return send(req, res, result.status, result.body);
    return send(req, res, 200, result);
  } catch (error) {
    if (error instanceof HttpError) return send(req, res, error.status, { error: error.message }, error.headers);
    console.error('[mock-api] unexpected error', error);
    return send(req, res, 500, { error: 'Internal error' });
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, '127.0.0.1', () => console.log(`[mock-api] admin API contract on http://localhost:${PORT}`));
}
