// Local mock of the admin API contract (docs/ADMIN.md). Plain node:http, no dependencies, deterministic seed data.
//
//   npm run dev:mock            -> http://localhost:3902
//   MOCK_PORT=3902 MOCK_LOGIN_LIMIT=5 MOCK_TOKEN_TTL=3600 node mock-api/server.mjs
//
// It answers like the REAL API (server/route/admin/*), which the dashboard was run against through
// server/test-harness: same routes, same bodies and status codes, same whitelists, same guards. A parity test
// (admin/tests/unit/parity.test.ts) runs one script against both and compares. It is for development and tests only:
// the passwords in seed.mjs are public.
import http from 'node:http';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { toCsv } from './csv.mjs';
import { buildSeed, hashPassword, MOCK_USERS, newId } from './seed.mjs';
import { generateSecret, otpauthUrl, totpStep } from './totp.mjs';

const PORT = Number(process.env.MOCK_PORT ?? 3902);
const JWT_SECRET = process.env.MOCK_JWT_SECRET ?? 'mock-jwt-secret-for-local-development-only';
const TOKEN_TTL = Number(process.env.MOCK_TOKEN_TTL ?? 3600);
const LOGIN_LIMIT = Number(process.env.MOCK_LOGIN_LIMIT ?? 5); // the real API: 5 failures per address and name per 15 minutes
const LOGIN_IP_LIMIT = 30; // ... and 30 per address across names
const WINDOW_MS = Number(process.env.MOCK_LOGIN_WINDOW_MS ?? 15 * 60_000);
const LOCK_MS = Number(process.env.MOCK_LOCK_MS ?? 15 * 60_000);
const ASSET_BASE = process.env.MOCK_ASSET_BASE ?? 'http://localhost:3901';
const ADMIN_ORIGINS = (process.env.ADMIN_ORIGINS ?? '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
// Where the password-reset e-mail points (the real API: ADMIN_APP_URL, default the Netlify site; here the local app).
const ADMIN_APP_URL = (process.env.ADMIN_APP_URL ?? 'http://localhost:3901').trim().replace(/\/+$/, '');
// While NO account exists, a reset request for one of these addresses creates the first owner (server/config/env.js).
const BOOTSTRAP_EMAILS = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? 'nazarethholycross@gmail.com').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const RESET_MINUTES = 30;
const IP_SALT = 'mock-ip-salt';
const ROLES = ['owner', 'editor', 'viewer'];
const RANK = { viewer: 1, editor: 2, owner: 3 };
const MAX_BODY = 10 * 1024; // the real API: 10 KB
const TIME_ZONE = 'Asia/Jerusalem';
const CATEGORIES = ['stained-glass', 'rosaries', 'necklaces', 'bracelets', 'bibles', 'crosses', 'holy-land', 'gifts'];
const PRAYER_CATEGORIES = ['Peace', 'Health', 'Gratitude', 'Family', 'Personal', 'World Peace'];

// ------------------------------------------------------------------ state

let db;
let emails;
let sessions; // sid -> { userId, revokedAt }
let audit;
let loginFailures; // "ip|name" -> [timestamps]; "ip" -> [timestamps]
let adminBuckets;
let privacyBuckets; // 20 privacy requests per 15 minutes per admin (the real API's adminErasureLimiter)
let resetBuckets; // forgot-password: 3 per address and e-mail, 10 per address; reset-password: 10 failures per address
let failMail = false;
// Test control: the next N calls to GET /admin/auth/me answer 429, as a busy API would (POST /__mock/busy { count }).
let busyMe = 0;
// Live broadcasting (server/route/admin/live.js): the sessions, and a fake Cloudflare Stream (inputs by uid), the
// recordings (route/admin/liveRecordings.js) with the fake's stored videos, and the scheduled broadcasts.
let live; // { sessions, inputs: Map, videos: Map, recordings, schedule, configured, failCreate, failUpload, storageCache }

function reset({ accounts = true } = {}) {
  const seed = buildSeed(Date.now(), ASSET_BASE);
  for (const rows of Object.values(seed)) for (const row of rows) row.updatedAt = row.createdAt; // Mongoose timestamps
  db = {
    ...seed,
    users: (accounts ? MOCK_USERS : []).map((u) => {
      const { salt, hash } = hashPassword(u.password);
      return {
        _id: newId('7'),
        username: u.username,
        email: u.email ?? '',
        role: u.role,
        disabled: false,
        salt,
        hash,
        totpSecret: u.totpSecret ?? null,
        totpLastStep: -1,
        pendingTotp: null,
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: null,
        resetTokenHash: null,
        resetTokenExpires: null,
        createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
      };
    }),
  };
  emails = [];
  sessions = new Map();
  audit = [];
  loginFailures = new Map();
  adminBuckets = new Map();
  privacyBuckets = new Map();
  resetBuckets = new Map();
  failMail = false;
  live = { sessions: [], inputs: new Map(), videos: new Map(), recordings: [], schedule: [], configured: true, failCreate: false, failUpload: false, storageCache: null };
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
  try {
    if (JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')).alg !== 'HS256') return null;
  } catch {
    return null;
  }
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
const DUMMY = { ...hashPassword('dummy-password-for-timing') };

// The real policy (server/services/passwordPolicy.js).
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'password12345', 'password123456',
  'passw0rd1234', 'p@ssw0rd1234', 'letmein12345', 'welcome12345', 'welcome123456', 'administrator',
  'administrator1', 'administrator123', 'adminadmin12', 'adminadmin123', 'admin1234567', 'admin12345678',
  'admin123456789', 'qwertyuiop12', 'qwertyuiop123', 'qwerty123456', 'qwerty1234567', 'qwertyuiopas',
  'asdfghjkl123', 'asdfghjklqwe', 'zxcvbnm12345', '1q2w3e4r5t6y', '1qaz2wsx3edc', '123456789012',
  '1234567890123', '12345678901234', '123456789abc', 'abcdefghijkl', 'abcd12345678', 'iloveyou1234',
  'iloveyou12345', 'monkey123456', 'dragon123456', 'football1234', 'baseball1234', 'superman1234',
  'changeme1234', 'changemenow1', 'nazareth1234', 'nazareth12345', 'nazarethholycross', 'holycross1234',
  'holycross12345', 'jerusalem123', 'jerusalem1234', 'letmeinplease', 'trustno1trustno1',
  '000000000000', '111111111111', 'aaaaaaaaaaaa',
]);
const normalise = (text) => text.toLowerCase().replace(/[\s._-]+/g, '');
function passwordProblem(password, username = '') {
  if (typeof password !== 'string') return 'Password must be text';
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (password.length > 200) return 'Password must be at most 200 characters';
  const flat = normalise(password);
  const name = normalise(String(username ?? ''));
  if (name && (flat === name || (flat.includes(name) && name.length >= 4 && flat.length - name.length < 4))) return 'Password must not be the username';
  if (COMMON.has(flat)) return 'Password is too common';
  if (new Set(password).size < 4) return 'Password is too repetitive';
  return null;
}

const clientIp = (req) => String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',').pop().trim() || 'unknown';

function uaSummary(ua = '') {
  const browser = /Edg(?:e|A|iOS)?\/(\d+)/.exec(ua) ? `Edge ${/Edg(?:e|A|iOS)?\/(\d+)/.exec(ua)[1]}` : /Firefox\/(\d+)/.exec(ua) ? `Firefox ${/Firefox\/(\d+)/.exec(ua)[1]}` : /(?:Chrome|CriOS)\/(\d+)/.exec(ua) ? `Chrome ${/(?:Chrome|CriOS)\/(\d+)/.exec(ua)[1]}` : /curl\/(\d+)/.exec(ua) ? `curl ${/curl\/(\d+)/.exec(ua)[1]}` : 'Other';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Macintosh|Mac OS/.test(ua) ? 'macOS' : /Linux|X11/.test(ua) ? 'Linux' : '';
  return os ? `${browser} / ${os}` : browser;
}

const clipText = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
const SECRET_KEY = /pass|secret|token|totp|otp|code|authorization|cookie|key|hash/i;
function cleanMeta(meta) {
  const out = {};
  for (const [key, value] of Object.entries(meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}).slice(0, 20)) {
    if (SECRET_KEY.test(key) || key.startsWith('$') || key.includes('.') || value === undefined) continue;
    out[clipText(key, 40)] = typeof value === 'string' ? clipText(value, 200) : typeof value === 'number' || typeof value === 'boolean' || value === null ? value : Array.isArray(value) ? value.slice(0, 10) : null;
  }
  return out;
}

// audit(req, 'order.update', { type, id }, meta) like server/services/audit.js
function record(req, action, target, meta, actor = req.auth?.user ?? req.auditActor) {
  audit.unshift({
    _id: newId('6'),
    at: new Date().toISOString(),
    actorId: req.auth?.user?._id ?? null,
    actorName: clipText(actor?.username, 100),
    role: clipText(actor?.role, 20),
    action: clipText(action, 60),
    target: { type: clipText(target?.type, 40), id: clipText(target?.id, 64) },
    meta: cleanMeta(meta),
    ipHash: createHash('sha256').update(IP_SALT + clientIp(req)).digest('hex').slice(0, 32),
    ua: uaSummary(String(req.headers['user-agent'] ?? '')),
  });
  if (audit.length > 5000) audit.length = 5000;
}

class HttpError extends Error {
  constructor(status, message, headers) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}
const fail = (field, why) => { throw new HttpError(400, `Invalid ${field}${why ? `: ${why}` : ''}`); };

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
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!size || !String(req.headers['content-type'] ?? '').includes('json')) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Malformed JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ---- the real API's body checker (server/utils/schema.js): strict, typed, bounded
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const OPT = Symbol('optional');
const opt = (rule) => Object.assign((v, f) => rule(v, f), { [OPT]: true });
const nullable = (rule) => (v, f) => (v === null ? null : rule(v, f));
// Text is stored HTML-escaped by the API's sanitizer (& < >): the mock does the same, so the dashboard's decoding is exercised.
const escapeText = (text) => text.replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decodeEntities = (text) => text.replace(/&(amp|lt|gt|quot|#39);/g, (_m, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[n]);
const str = ({ min = 1, max = 200, pattern, multiline = false, escape = true } = {}) => (v, f) => {
  if (typeof v !== 'string') fail(f, 'must be text');
  const text = v.trim();
  if (text.length < min || text.length > max) fail(f, `length must be ${min} to ${max}`);
  if (CONTROL_CHARS.test(text)) fail(f, 'contains control characters');
  if (!multiline && /[\r\n\t]/.test(text)) fail(f, 'must be a single line');
  if (pattern && !pattern.test(text)) fail(f, 'wrong format');
  return escape ? escapeText(text) : text;
};
const secret = ({ min = 1, max = 200 } = {}) => (v, f) => {
  if (typeof v !== 'string') fail(f, 'must be text');
  if (v.length < min || v.length > max) fail(f, `length must be ${min} to ${max}`);
  return v;
};
const num = ({ min = -Infinity, max = Infinity } = {}) => (v, f) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(f, 'must be a number');
  if (v < min || v > max) fail(f, `must be between ${min} and ${max}`);
  return v;
};
const int = ({ min = -Infinity, max = Infinity } = {}) => (v, f) => {
  if (!Number.isInteger(v)) fail(f, 'must be a whole number');
  if (v < min || v > max) fail(f, `must be between ${min} and ${max}`);
  return v;
};
const bool = () => (v, f) => { if (typeof v !== 'boolean') fail(f, 'must be true or false'); return v; };
const oneOf = (allowed) => (v, f) => { if (typeof v !== 'string' || !allowed.includes(v)) fail(f, `must be one of ${allowed.join(', ')}`); return v; };
const arrayOf = (rule, { max = 50 } = {}) => (v, f) => {
  if (!Array.isArray(v)) fail(f, 'must be a list');
  if (v.length > max) fail(f, `at most ${max} items`);
  return v.map((item) => rule(item, f));
};
const url = ({ max = 2048 } = {}) => (v, f) => {
  if (typeof v !== 'string') fail(f, 'must be text');
  const text = decodeEntities(v.trim());
  if (text.length < 8 || text.length > max) fail(f, `length must be 8 to ${max}`);
  if (!/^https?:\/\/[^\s<>"'`\\]+$/i.test(text)) fail(f, 'must be an http(s) address');
  try { if (!new URL(text).hostname) fail(f, 'must be an http(s) address'); } catch (e) { if (e instanceof HttpError) throw e; fail(f, 'must be an http(s) address'); }
  return text;
};
function parseBody(body, shape) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) fail('body', 'must be a JSON object');
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(shape, key)) throw new HttpError(400, `Unexpected field: ${key.replace(/[^\w.-]/g, '?').slice(0, 40)}`);
  }
  const clean = {};
  for (const [field, rule] of Object.entries(shape)) {
    const value = body[field];
    if (value === undefined) {
      if (!rule[OPT]) throw new HttpError(400, `${field} is required`);
      continue;
    }
    clean[field] = rule(value, field);
  }
  return clean;
}

const isId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
const objectId = (v) => { if (!isId(v)) throw new HttpError(400, 'Invalid id'); return v.toLowerCase(); };
const found = (doc, what) => { if (!doc) throw new HttpError(404, `${what} not found`); return doc; };

// ------------------------------------------------------------------ auth + roles

function authenticate(req, route) {
  const header = String(req.headers.authorization ?? '');
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Unauthorized');
  const claims = verifyJwt(header.slice(7));
  if (!claims || typeof claims.sid !== 'string') throw new HttpError(401, 'Invalid or expired token');
  const session = sessions.get(claims.sid);
  if (!session || session.revokedAt || session.userId !== claims.sub) throw new HttpError(401, 'Session ended');
  const user = db.users.find((u) => u._id === claims.sub);
  if (!user || user.disabled) throw new HttpError(401, 'Session ended');

  const bucket = adminBuckets.get(user._id) ?? { start: Date.now(), count: 0 };
  if (Date.now() - bucket.start > WINDOW_MS) Object.assign(bucket, { start: Date.now(), count: 0 });
  bucket.count += 1;
  adminBuckets.set(user._id, bucket);
  if (bucket.count > 300) throw new HttpError(429, 'Too many requests, please slow down.', { 'Retry-After': '60' });

  req.auth = { user, sid: claims.sid };
  if (route.min && RANK[user.role] < RANK[route.min]) throw new HttpError(403, 'Forbidden');
}
const revokeAll = (userId, exceptSid) => { for (const [sid, s] of sessions) if (s.userId === userId && sid !== exceptSid && !s.revokedAt) s.revokedAt = Date.now(); };

const publicUser = (u) => ({ id: u._id, username: u.username, role: u.role, totpEnabled: Boolean(u.totpSecret) });
// GET /admin/users items (server/route/admin/users.js present())
const userItem = (u) => ({
  _id: u._id, username: u.username, email: u.email ?? '', role: u.role, disabled: u.disabled, totpEnabled: Boolean(u.totpSecret),
  lockedUntil: u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now() ? u.lockedUntil : null, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
});

// ------------------------------------------------------------------ lists (server/route/admin/common.js)

function parseList(url, { searchable, statuses = {}, sorts, defaultSort = '-createdAt' }) {
  const num = (key, fallback, min, max) => {
    const n = Number.parseInt((url.searchParams.get(key) ?? '').trim(), 10);
    return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const page = num('page', 1, 1, 10_000);
  const size = num('size', 25, 1, 100);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length > 100) throw new HttpError(400, 'Invalid q: at most 100 characters');
  const status = (url.searchParams.get('status') ?? '').trim();
  if (status && status !== 'all' && !Object.hasOwn(statuses, status)) throw new HttpError(400, `Invalid status: use ${['all', ...Object.keys(statuses)].join(', ')}`);
  const sortText = (url.searchParams.get('sort') ?? '').trim() || defaultSort;
  const desc = sortText.startsWith('-');
  const key = desc ? sortText.slice(1) : sortText;
  if (!sorts.includes(key)) throw new HttpError(400, `Invalid sort: use ${sorts.join(', ')} (prefix - for descending)`);
  return { page, size, q: q.toLowerCase(), status, key, desc, searchable, statuses };
}

// server/utils/orderNumber.js and route/admin/orders.js orderNumberClause
const orderNumber = (id) => `#${String(id ?? '').slice(-8)}`;
const ORDER_NUMBER = /^#?\s*([a-f0-9]{6,24})$/i;

function paginate(url, rows, options) {
  const p = parseList(url, options);
  let list = rows;
  const number = options.byNumber ? ORDER_NUMBER.exec(p.q)?.[1]?.toLowerCase() : undefined;
  if (p.q) list = list.filter((row) => (isId(p.q) && String(row._id) === p.q) || (number && String(row._id).toLowerCase().endsWith(number)) || options.searchable(row).some((v) => decodeEntities(String(v ?? '')).toLowerCase().includes(p.q) || String(v ?? '').toLowerCase().includes(p.q)));
  if (p.status && p.status !== 'all') list = list.filter(p.statuses[p.status]);
  const get = (row) => row[p.key] ?? null;
  list = [...list].sort((a, b) => {
    const av = get(a); const bv = get(b);
    let cmp = av === bv ? 0 : av === null ? 1 : bv === null ? -1 : typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av) < String(bv) ? -1 : 1;
    if (cmp !== 0) return p.desc ? -cmp : cmp;
    cmp = String(b._id).localeCompare(String(a._id)); // ties: newest id first (the real API sorts by _id: -1 too)
    return cmp;
  });
  return { items: list.slice((p.page - 1) * p.size, p.page * p.size), total: list.length, page: p.page, size: p.size };
}

const byId = (rows, id) => rows.find((r) => r._id === id);

// One resource of the collections router (server/route/admin/collections.js)
function collection({ name, type, label, rows, searchable, byNumber = false, statuses, sorts, flag, deleteRole = 'editor', onChange }) {
  const out = [];
  out.push({ method: 'GET', path: `/admin/${name}`, min: 'viewer', run: (ctx) => paginate(ctx.url, rows(), { searchable, byNumber, statuses, sorts }) });
  out.push({ method: 'GET', path: `/admin/${name}/:id`, min: 'viewer', run: (ctx) => found(byId(rows(), objectId(ctx.params.id)), label) });
  if (flag) {
    out.push({
      method: 'PATCH', path: `/admin/${name}/:id`, min: 'editor',
      run: (ctx) => {
        const id = objectId(ctx.params.id);
        const body = parseBody(ctx.body, { [flag]: bool() });
        const row = found(byId(rows(), id), label);
        const before = row[flag];
        row[flag] = body[flag];
        row.updatedAt = new Date().toISOString();
        const result = onChange ? onChange(row, before) : {};
        record(ctx.req, `${type}.update`, { type, id }, { [flag]: body[flag], ...(result.meta ?? {}) });
        // like findByIdAndUpdate().lean(): a reviewed product comes back as its id, not populated
        return { item: row.product && typeof row.product === 'object' ? { ...row, product: row.product._id } : row, ...(result.extra ?? {}) };
      },
    });
  }
  out.push({
    method: 'DELETE', path: `/admin/${name}/:id`, min: deleteRole,
    run: (ctx) => {
      const id = objectId(ctx.params.id);
      const list = rows();
      const index = list.findIndex((r) => r._id === id);
      found(index >= 0 ? list[index] : null, label);
      list.splice(index, 1);
      record(ctx.req, `${type}.delete`, { type, id });
      return { message: type === 'order' ? 'Order deleted' : 'Deleted' };
    },
  });
  return out;
}

// ------------------------------------------------------------------ products (server/route/admin/products.js)

const PRODUCT_FIELDS = {
  name: str({ min: 2, max: 200 }),
  price: (v, f) => {
    const price = num({ min: 0.01, max: 10_000 })(v, f);
    if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) throw new HttpError(400, `Invalid ${f}: at most two decimals`);
    return price;
  },
  img: url(),
  additionalImageUrls: arrayOf(url(), { max: 20 }),
  description: str({ min: 0, max: 2000, multiline: true }),
  uuidv4_: str({ min: 1, max: 64 }),
  rate: num({ min: 0, max: 5 }),
  color: arrayOf(str({ min: 1, max: 50 }), { max: 20 }),
  stock: nullable(int({ min: 0, max: 1_000_000 })),
  category: nullable(oneOf(CATEGORIES)),
};
// server/route/admin/products.js imageHostAllowed: a photo must be on a host the website can show (PRODUCT_IMAGE_HOSTS);
// a local address too (the mock is never production). A photo already saved on the product stays editable around it.
const PRODUCT_IMAGE_HOSTS = (process.env.PRODUCT_IMAGE_HOSTS ?? 'firebasestorage.googleapis.com').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
const imageHostAllowed = (address) => {
  try {
    const u = new URL(address);
    if (u.protocol === 'https:' && PRODUCT_IMAGE_HOSTS.includes(u.hostname.toLowerCase())) return true;
    return ['localhost', '127.0.0.1'].includes(u.hostname) && (u.protocol === 'http:' || u.protocol === 'https:');
  } catch { return false; }
};
function checkImageHosts(fields, before = null) {
  const hosts = PRODUCT_IMAGE_HOSTS.join(', ');
  if (fields.img !== undefined && fields.img !== before?.img && !imageHostAllowed(fields.img)) throw new HttpError(400, `Invalid img: the website shows photos only from ${hosts}`);
  const known = new Set(before?.additionalImageUrls ?? []);
  if ((fields.additionalImageUrls ?? []).some((u) => !known.has(u) && !imageHostAllowed(u))) throw new HttpError(400, `Invalid additionalImageUrls: the website shows photos only from ${hosts}`);
}
// services/siteRefresh.js: the mock never calls a website (as the API without REVALIDATE_SECRET): 'off'.
const SITE_REFRESH = 'off';
const CREATE_SHAPE = Object.fromEntries(Object.entries(PRODUCT_FIELDS).map(([k, r]) => [k, ['name', 'price', 'img'].includes(k) ? r : opt(r)]));
const UPDATE_SHAPE = Object.fromEntries(Object.entries(PRODUCT_FIELDS).map(([k, r]) => [k, opt(r)]));

// ------------------------------------------------------------------ dashboard (server/services/dashboard.js)

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (date) => dayFormat.format(date);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function dashboard() {
  const now = new Date();
  const [y, m, d] = dayKey(now).split('-').map(Number);
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(y, m - 1, d - (29 - i))).toISOString().slice(0, 10));
  const map = new Map(days.map((day) => [day, { date: day, orders: 0, revenue: 0, candles: 0 }]));
  // Revenue = verified payments only (server/services/dashboard.js); the unverified orders are counted apart.
  for (const o of db.orders) { const e = map.get(dayKey(new Date(o.createdAt))); if (e) { e.orders += 1; if (o.paymentVerified === true) e.revenue = round2(e.revenue + o.totalPrice); } }
  for (const c of db.candles) { const e = map.get(dayKey(new Date(c.createdAt))); if (e) e.candles += 1; }

  const sold = new Map();
  for (const o of db.orders) {
    for (const l of o.products) {
      if (!l.productID) continue;
      const product = db.products.find((p) => p._id === l.productID);
      const cur = sold.get(l.productID) ?? { productId: l.productID, name: product?.name ?? l.productName ?? '', sold: 0 };
      cur.sold += l.quantity;
      sold.set(l.productID, cur);
    }
  }
  const top = [...sold.values()].sort((a, b) => b.sold - a.sold || (a.productId < b.productId ? -1 : 1)).slice(0, 5)
    .map((p) => ({ ...p, revenue: round2(p.sold * (db.products.find((x) => x._id === p.productId)?.price ?? 0)) }));
  const newest = (rows, fields) => [...rows].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5).map((r) => Object.fromEntries(['_id', ...fields].map((f) => [f, r[f]])));
  return {
    generatedAt: now.toISOString(),
    totals: {
      orders: db.orders.length,
      ordersPending: db.orders.filter((o) => o.done !== true).length,
      revenue: round2(db.orders.filter((o) => o.paymentVerified === true).reduce((s, o) => s + o.totalPrice, 0)),
      revenueUnverified: round2(db.orders.filter((o) => o.paymentVerified !== true).reduce((s, o) => s + o.totalPrice, 0)),
      ordersUnverified: db.orders.filter((o) => o.paymentVerified !== true).length,
      candles: db.candles.length,
      candlesPending: db.candles.filter((c) => c.done === false).length,
      contacts: db.contacts.length,
      contactsOpen: db.contacts.filter((c) => c.done === false).length,
      products: db.products.length,
      productReviews: db.productReviews.length,
      prayers: db.prayers.length,
      reviews: db.siteReviews.length,
    },
    last30Days: days.map((day) => map.get(day)),
    topProducts: top,
    lowStock: db.products.filter((p) => typeof p.stock === 'number' && p.stock <= 5).sort((a, b) => a.stock - b.stock || (a.name < b.name ? -1 : 1)).slice(0, 20).map((p) => ({ productId: p._id, name: p.name, stock: p.stock })),
    recent: {
      orders: newest(db.orders, ['firstName', 'lastName', 'email', 'totalPrice', 'done', 'paymentVerified', 'createdAt']),
      candles: newest(db.candles, ['firstName', 'lastName', 'email', 'prayer', 'done', 'createdAt']),
      contacts: newest(db.contacts, ['fullName', 'email', 'msg', 'done', 'createdAt']),
    },
    // Customers who paid but whose order or candle request was never saved (server/services/payments.js)
    alerts: { unfulfilledPayments: { count: unfulfilledPayments().length, amount: round2(unfulfilledPayments().reduce((s, p) => s + p.amount, 0)) } },
  };
}

// ------------------------------------------------------------------ payment ledger (server/model/payment.js, services/payments.js)

const GRACE_MS = 10 * 60 * 1000; // a captured payment is only "unfulfilled" after this long
// Captured, for an order / candle / old client, nothing linked, not resolved, past the grace period. Donations never.
function unfulfilledPayments(now = Date.now()) {
  return db.payments.filter((p) => p.status === 'captured' && ['order', 'candle', 'unknown'].includes(p.type) && !p.linkedTo?.id && !p.resolvedAt && p.capturedAt && new Date(p.capturedAt).getTime() <= now - GRACE_MS);
}

// ------------------------------------------------------------------ routes

const routes = [];
const add = (route) => routes.push(route);

// --- auth
add({
  method: 'POST', path: '/admin/auth/login', public: true,
  run: async (ctx) => {
    const body = ctx.body !== null && typeof ctx.body === 'object' && !Array.isArray(ctx.body) ? ctx.body : {};
    const { username, password, totp } = body;
    const ip = clientIp(ctx.req);
    const nameKey = `${ip}|${(typeof username === 'string' ? username : '').toLowerCase().slice(0, 100)}`;
    const now = Date.now();
    const recent = (key) => (loginFailures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    // The real limiters (express-rate-limit) refuse before looking at the body once the budget of FAILURES is used.
    if (recent(nameKey).length >= LOGIN_LIMIT || recent(ip).length >= LOGIN_IP_LIMIT) {
      const oldest = Math.min(...recent(nameKey), ...recent(ip));
      throw new HttpError(429, 'Too many login attempts, please try again in 15 minutes.', { 'Retry-After': String(Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000))) });
    }
    const failed = (user, reason) => {
      for (const key of [nameKey, ip]) loginFailures.set(key, [...recent(key), now]);
      ctx.req.auditActor = { username: typeof username === 'string' ? username.trim().slice(0, 100) : '' };
      if (user && (reason === 'wrong_password' || reason === 'wrong_totp')) {
        user.failedLogins += 1;
        if (user.failedLogins >= 5) {
          user.lockedUntil = new Date(now + LOCK_MS).toISOString();
          user.failedLogins = 0;
          record(ctx.req, 'auth.login_failed', { type: 'admin', id: user._id }, { reason });
          record(ctx.req, 'auth.account_locked', { type: 'admin', id: user._id }, { minutes: LOCK_MS / 60_000 });
          return new HttpError(401, 'Invalid credentials');
        }
      }
      record(ctx.req, 'auth.login_failed', user ? { type: 'admin', id: user._id } : null, { reason });
      return new HttpError(401, 'Invalid credentials');
    };

    const wellFormed = typeof username === 'string' && username.trim().length > 0 && username.length <= 100
      && typeof password === 'string' && password.length > 0 && password.length <= 200 && (totp === undefined || typeof totp === 'string');
    // Like the API: the exact username, else the account e-mail without regard to case.
    const signInName = wellFormed ? username.trim() : '';
    const user = wellFormed ? (db.users.find((u) => u.username === signInName) ?? (signInName.includes('@') ? db.users.find((u) => typeof u.email === 'string' && u.email.toLowerCase() === signInName.toLowerCase()) : undefined) ?? null) : null;
    const locked = Boolean(user?.lockedUntil) && new Date(user.lockedUntil).getTime() > now;
    const usable = user && !locked && !user.disabled;
    const passwordOk = checkPassword(usable ? user : DUMMY, wellFormed ? password : '') && Boolean(usable); // same work for every case

    if (!wellFormed || !usable || !passwordOk) throw failed(user, !wellFormed ? 'malformed' : !user ? 'unknown_user' : locked ? 'locked' : user.disabled ? 'disabled' : 'wrong_password');

    let usedStep = null;
    if (user.totpSecret) {
      if (!/^\d{6}$/.test(totp ?? '')) throw new HttpError(428, 'totp_required');
      usedStep = totpStep(user.totpSecret, totp, { afterStep: user.totpLastStep });
      if (usedStep === null) throw failed(user, 'wrong_totp');
    }
    Object.assign(user, { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(now).toISOString(), ...(usedStep !== null ? { totpLastStep: usedStep } : {}) });
    const sid = randomBytes(24).toString('base64url');
    sessions.set(sid, { userId: user._id, revokedAt: null });
    const iat = Math.floor(now / 1000);
    const token = signJwt({ sub: user._id, role: user.role, sid, iat, exp: iat + TOKEN_TTL });
    ctx.req.auth = { user, sid };
    record(ctx.req, 'auth.login', { type: 'admin', id: user._id }, { totp: Boolean(user.totpSecret) });
    return { token, expiresIn: TOKEN_TTL, user: publicUser(user) };
  },
});

add({
  method: 'POST', path: '/admin/auth/logout', min: 'viewer',
  run: (ctx) => {
    sessions.get(ctx.req.auth.sid).revokedAt = Date.now();
    record(ctx.req, 'auth.logout', { type: 'admin', id: ctx.req.auth.user._id });
    return 204;
  },
});

add({ method: 'GET', path: '/admin/auth/me', min: 'viewer', run: (ctx) => ({ ...publicUser(ctx.req.auth.user), lastLoginAt: ctx.req.auth.user.lastLoginAt }) });

// 5 wrong tries per 15 minutes per account on the sensitive routes (password, totp enable/disable), then 429
const sensitive = new Map();
function sensitiveBudget(userId) {
  const now = Date.now();
  const used = (sensitive.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (used.length >= 5) throw new HttpError(429, 'Too many attempts, please try again in 15 minutes.', { 'Retry-After': '900' });
  return () => sensitive.set(userId, [...used, now]);
}

add({
  method: 'POST', path: '/admin/auth/password', min: 'viewer',
  run: (ctx) => {
    const u = ctx.req.auth.user;
    const budget = sensitiveBudget(u._id);
    const { currentPassword, newPassword } = parseBody(ctx.body, { currentPassword: secret(), newPassword: secret({ max: 200 }) });
    if (!checkPassword(u, currentPassword)) {
      budget();
      record(ctx.req, 'auth.password_change_failed', { type: 'admin', id: u._id }, { reason: 'wrong_current_password' });
      throw new HttpError(403, 'Current password is incorrect');
    }
    const problem = passwordProblem(newPassword, u.username);
    if (problem) { budget(); throw new HttpError(400, problem); }
    if (checkPassword(u, newPassword)) { budget(); throw new HttpError(400, 'The new password must differ from the current one'); }
    Object.assign(u, hashPassword(newPassword), { failedLogins: 0, lockedUntil: null });
    revokeAll(u._id, ctx.req.auth.sid);
    record(ctx.req, 'auth.password_change', { type: 'admin', id: u._id });
    return 204;
  },
});

add({
  method: 'POST', path: '/admin/auth/totp/setup', min: 'viewer',
  run: (ctx) => {
    const u = ctx.req.auth.user;
    if (u.totpSecret) throw new HttpError(409, 'TOTP is already enabled; disable it first');
    u.pendingTotp = generateSecret();
    record(ctx.req, 'auth.totp_setup', { type: 'admin', id: u._id });
    return { secret: u.pendingTotp, otpauthUrl: otpauthUrl(u.pendingTotp, u.username) };
  },
});

add({
  method: 'POST', path: '/admin/auth/totp/enable', min: 'viewer',
  run: (ctx) => {
    const u = ctx.req.auth.user;
    const budget = sensitiveBudget(u._id);
    const { code } = parseBody(ctx.body, { code: str({ min: 6, max: 6, pattern: /^\d{6}$/ }) });
    if (u.totpSecret) throw new HttpError(409, 'TOTP is already enabled');
    if (!u.pendingTotp) throw new HttpError(409, 'Start with POST /admin/auth/totp/setup');
    const step = totpStep(u.pendingTotp, code, { afterStep: -1 });
    if (step === null) {
      budget();
      record(ctx.req, 'auth.totp_enable_failed', { type: 'admin', id: u._id });
      throw new HttpError(400, 'Invalid code');
    }
    Object.assign(u, { totpSecret: u.pendingTotp, pendingTotp: null, totpLastStep: step });
    revokeAll(u._id, ctx.req.auth.sid);
    record(ctx.req, 'auth.totp_enable', { type: 'admin', id: u._id });
    return 204;
  },
});

add({
  method: 'POST', path: '/admin/auth/totp/disable', min: 'viewer',
  run: (ctx) => {
    const u = ctx.req.auth.user;
    const budget = sensitiveBudget(u._id);
    const { password, code } = parseBody(ctx.body, { password: secret(), code: str({ min: 6, max: 6, pattern: /^\d{6}$/ }) });
    if (!checkPassword(u, password)) {
      budget();
      record(ctx.req, 'auth.totp_disable_failed', { type: 'admin', id: u._id }, { reason: 'wrong_password' });
      throw new HttpError(403, 'Current password is incorrect');
    }
    if (!u.totpSecret) throw new HttpError(409, 'TOTP is not enabled');
    const step = totpStep(u.totpSecret, code, { afterStep: u.totpLastStep });
    if (step === null) {
      budget();
      record(ctx.req, 'auth.totp_disable_failed', { type: 'admin', id: u._id }, { reason: 'wrong_code' });
      throw new HttpError(403, 'Invalid code');
    }
    Object.assign(u, { totpSecret: null, totpLastStep: -1 });
    revokeAll(u._id, ctx.req.auth.sid);
    record(ctx.req, 'auth.totp_disable', { type: 'admin', id: u._id });
    return 204;
  },
});

// --- forgotten password (server/route/admin/auth.js, services/passwordReset.js)
// POST /admin/auth/forgot-password { email } -> always 202 { ok: true }; POST /admin/auth/reset-password { token, password }
// -> 204, or 400 for a link that is invalid, used or expired, or a password the policy refuses. Only the SHA-256 of
// the token is kept; the token itself is only in the recorded e-mail.
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const BAD_LINK = 'This link is invalid or has expired. Ask for a new one.';
const looksLikeEmail = (value) => value.length >= 6 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
// Like express-rate-limit: the request is counted, and over the limit the answer is 429 with Retry-After.
function hit(key, limit, message, { count = true } = {}) {
  const now = Date.now();
  const recent = (resetBuckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (count) recent.push(now);
  resetBuckets.set(key, recent);
  if (recent.length > limit || (!count && recent.length >= limit)) {
    throw new HttpError(429, message, { 'Retry-After': String(Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000))) });
  }
}

add({
  method: 'POST', path: '/admin/auth/forgot-password', public: true,
  run: (ctx) => {
    const ip = clientIp(ctx.req);
    const email = (typeof ctx.body?.email === 'string' ? ctx.body.email : '').trim().toLowerCase();
    hit(`forgot|${ip}|${email.slice(0, 254)}`, 3, 'Too many requests, please try again in 15 minutes.');
    hit(`forgot|${ip}`, 10, 'Too many requests, please try again in 15 minutes.');
    ctx.req.auditActor = { username: email.slice(0, 100) };
    if (!looksLikeEmail(email)) return { status: 202, body: { ok: true } };

    let user = db.users.find((u) => String(u.email ?? '').toLowerCase() === email || u.username.toLowerCase() === email);
    let created = false;
    if (!user && BOOTSTRAP_EMAILS.includes(email) && db.users.length === 0) {
      // The first owner, with a password nobody knows: the link is the only way in.
      user = {
        _id: newId('7'), username: email, email, role: 'owner', disabled: false, ...hashPassword(randomBytes(32).toString('base64url')),
        totpSecret: null, totpLastStep: -1, pendingTotp: null, failedLogins: 0, lockedUntil: null, lastLoginAt: null,
        resetTokenHash: null, resetTokenExpires: null, createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      created = true;
    }
    if (!user || user.disabled) return { status: 202, body: { ok: true } };

    const token = randomBytes(32).toString('base64url'); // 43 characters
    Object.assign(user, { resetTokenHash: sha256(token), resetTokenExpires: Date.now() + RESET_MINUTES * 60_000 });
    const link = `${ADMIN_APP_URL}/reset-password?token=${token}`;
    const intro = created
      ? 'An owner account was created for this address on the Nazareth Holy Cross dashboard.'
      : 'Someone asked to reset the password of your Nazareth Holy Cross dashboard account.';
    const mailed = !failMail;
    if (mailed) {
      emails.push({
        at: new Date().toISOString(),
        to: [String(user.email || email).toLowerCase()],
        subject: created ? 'Nazareth Holy Cross dashboard: choose your password' : 'Nazareth Holy Cross dashboard: reset your password',
        text: [intro, '', `Choose a password here (the link works once, for ${RESET_MINUTES} minutes):`, link, '', `Your username: ${user.username}`, '', 'If you did not ask for this, ignore this e-mail: nothing changes.'].join('\n'),
        html: `<p>${intro}</p><p><a href="${link}">Choose a password</a> (the link works once, for ${RESET_MINUTES} minutes).</p>`,
      });
    }
    if (created) record(ctx.req, 'auth.owner_bootstrap', { type: 'admin', id: user._id });
    record(ctx.req, 'auth.password_reset_requested', { type: 'admin', id: user._id }, { mailed });
    return { status: 202, body: { ok: true } };
  },
});

add({
  method: 'POST', path: '/admin/auth/reset-password', public: true,
  run: (ctx) => {
    const key = `reset|${clientIp(ctx.req)}`;
    hit(key, 10, 'Too many attempts, please try again in 15 minutes.', { count: false }); // only failures count
    const failed = (message) => { hit(key, Infinity, ''); return new HttpError(400, message); };
    const body = ctx.body !== null && typeof ctx.body === 'object' && !Array.isArray(ctx.body) ? ctx.body : {};
    const { token, password } = body;
    if (typeof password !== 'string' || password.length === 0 || password.length > 200) throw failed('Choose a password');
    const user = typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
      ? db.users.find((u) => u.resetTokenHash && u.resetTokenHash === sha256(token))
      : null;
    if (!user || !user.resetTokenExpires || user.resetTokenExpires <= Date.now() || user.disabled) throw failed(BAD_LINK);
    const problem = passwordProblem(password, user.username);
    if (problem) throw failed(problem);
    Object.assign(user, hashPassword(password), { resetTokenHash: null, resetTokenExpires: null, failedLogins: 0, lockedUntil: null });
    revokeAll(user._id);
    ctx.req.auditActor = { username: user.username, role: user.role };
    record(ctx.req, 'auth.password_reset', { type: 'admin', id: user._id });
    return 204;
  },
});

// --- dashboard
add({ method: 'GET', path: '/admin/dashboard', min: 'viewer', run: () => dashboard() });

// --- orders
for (const route of collection({
  name: 'orders', type: 'order', label: 'Order', rows: () => db.orders, flag: 'done', deleteRole: 'owner',
  searchable: (o) => [o.firstName, o.lastName, o.email, o.phone, o.city, o.country, o.paypalOrderId],
  byNumber: true,
  statuses: { pending: (o) => o.done !== true, shipped: (o) => o.done === true, unverified: (o) => o.paymentVerified !== true },
  sorts: ['createdAt', 'totalPrice', 'lastName'],
  // Shipping e-mails the customer once (server/route/admin/orders.js): emailSent true | false | null (nothing was due).
  onChange: (row, before) => {
    if (!row.done || before === true) return { extra: { emailSent: null }, meta: { emailSent: null } }; // un-shipped, or already shipped: no mail due
    if (failMail) return { extra: { emailSent: false }, meta: { emailSent: false } };
    emails.push({ at: new Date().toISOString(), to: [row.email], subject: `Your order ${orderNumber(row._id)} was shipped`, text: `Your order ${orderNumber(row._id)} was shipped :) (reference ${row._id})` });
    return { extra: { emailSent: true }, meta: { emailSent: true } };
  },
})) add(route);
for (const route of collection({
  name: 'candles', type: 'candle', label: 'candle', rows: () => db.candles, flag: 'done',
  searchable: (c) => [c.firstName, c.lastName, c.email, c.prayer],
  statuses: { pending: (c) => c.done !== true, done: (c) => c.done === true }, sorts: ['createdAt', 'lastName'],
})) add(route);
for (const route of collection({
  name: 'contacts', type: 'contact', label: 'contact', rows: () => db.contacts, flag: 'done',
  searchable: (c) => [c.fullName, c.email, c.phone, c.msg],
  statuses: { open: (c) => c.done !== true, done: (c) => c.done === true }, sorts: ['createdAt', 'fullName'],
})) add(route);
for (const route of collection({
  name: 'site-reviews', type: 'site-review', label: 'site-review', rows: () => db.siteReviews, flag: 'approved',
  searchable: (r) => [r.fullName, r.place, r.email, r.msg],
  statuses: { approved: (r) => r.approved === true, hidden: (r) => r.approved === false }, sorts: ['createdAt', 'fullName'],
})) add(route);
for (const route of collection({
  name: 'product-reviews', type: 'product-review', label: 'product-review', rows: () => db.productReviews, flag: 'approved',
  searchable: (r) => [r.name, r.country, r.title, r.comment],
  statuses: { approved: (r) => r.approved === true, hidden: (r) => r.approved === false }, sorts: ['createdAt', 'rating'],
})) add(route);
for (const route of collection({
  name: 'prayers', type: 'prayer', label: 'prayer', rows: () => db.prayers,
  searchable: (p) => [p.name, p.country, p.prayer],
  statuses: Object.fromEntries(PRAYER_CATEGORIES.map((c) => [c, (p) => p.category === c])), sorts: ['createdAt', 'likes'],
})) add(route);

// --- payments (server/route/admin/payments.js): the ledger is read and resolved, never deleted
add({
  method: 'GET', path: '/admin/payments', min: 'viewer',
  run: (ctx) => paginate(ctx.url, db.payments, {
    searchable: (p) => [p.paypalOrderId, p.payerEmail, p.payerName, p.donorName, p.notes],
    statuses: {
      unfulfilled: (p) => unfulfilledPayments().includes(p),
      captured: (p) => p.status === 'captured', created: (p) => p.status === 'created', failed: (p) => p.status === 'failed',
      resolved: (p) => p.resolvedAt !== null && p.resolvedAt !== undefined,
      order: (p) => p.type === 'order', candle: (p) => p.type === 'candle', donation: (p) => p.type === 'donation',
    },
    sorts: ['createdAt', 'capturedAt', 'amount', 'status'],
  }),
});
add({ method: 'GET', path: '/admin/payments/:id', min: 'viewer', run: (ctx) => found(byId(db.payments, objectId(ctx.params.id)), 'Payment') });
add({
  method: 'PATCH', path: '/admin/payments/:id', min: 'editor',
  run: (ctx) => {
    const id = objectId(ctx.params.id);
    const body = parseBody(ctx.body, { resolved: bool(), note: opt(str({ min: 1, max: 1000, multiline: true })) });
    if (body.resolved && !body.note) throw new HttpError(400, 'note is required when resolving a payment');
    const payment = found(byId(db.payments, id), 'Payment');
    if (body.resolved && payment.linkedTo?.id) throw new HttpError(409, 'This payment is already linked to an order or candle request');
    if (body.resolved) Object.assign(payment, { resolvedAt: new Date().toISOString(), resolvedBy: ctx.req.auth.user.username, notes: body.note });
    else Object.assign(payment, { resolvedAt: null, ...(body.note ? { notes: body.note } : {}) });
    payment.updatedAt = new Date().toISOString();
    record(ctx.req, 'payment.update', { type: 'payment', id }, { resolved: body.resolved, paypalOrderId: payment.paypalOrderId });
    return { item: payment };
  },
});

// --- products
add({
  method: 'GET', path: '/admin/products', min: 'viewer',
  run: (ctx) => paginate(ctx.url, db.products, {
    searchable: (p) => [p.name, p.description, p.uuidv4_],
    statuses: { ok: (p) => p.stock === null || p.stock === undefined || p.stock > 5, low: (p) => typeof p.stock === 'number' && p.stock <= 5, out: (p) => p.stock === 0 },
    sorts: ['createdAt', 'name', 'price', 'stock', 'rate'],
  }),
});
add({ method: 'GET', path: '/admin/products/:id', min: 'viewer', run: (ctx) => found(byId(db.products, objectId(ctx.params.id)), 'Product') });
add({
  method: 'POST', path: '/admin/products', min: 'editor',
  run: (ctx) => {
    const data = parseBody(ctx.body, CREATE_SHAPE);
    checkImageHosts(data);
    const now = new Date().toISOString();
    const product = { _id: newId('b'), additionalImageUrls: [], description: '', color: [], rate: 1, stock: null, ...data, createdAt: now, updatedAt: now };
    db.products.unshift(product);
    record(ctx.req, 'product.create', { type: 'product', id: product._id }, { name: data.name });
    return { status: 201, body: { item: product, siteRefresh: SITE_REFRESH } };
  },
});
const updateProduct = (ctx) => {
  const id = objectId(ctx.params.id);
  const fields = parseBody(ctx.body, UPDATE_SHAPE);
  if (Object.keys(fields).length === 0) throw new HttpError(400, 'No fields to update');
  const product = found(byId(db.products, id), 'Product');
  checkImageHosts(fields, product);
  Object.assign(product, fields, { updatedAt: new Date().toISOString() });
  record(ctx.req, 'product.update', { type: 'product', id }, { fields: Object.keys(fields) });
  return { item: product, siteRefresh: SITE_REFRESH };
};
add({ method: 'PUT', path: '/admin/products/:id', min: 'editor', run: updateProduct });
add({ method: 'PATCH', path: '/admin/products/:id', min: 'editor', run: updateProduct });
add({
  method: 'DELETE', path: '/admin/products/:id', min: 'editor',
  run: (ctx) => {
    const id = objectId(ctx.params.id);
    const index = db.products.findIndex((p) => p._id === id);
    const product = found(index >= 0 ? db.products[index] : null, 'Product');
    db.products.splice(index, 1);
    record(ctx.req, 'product.delete', { type: 'product', id }, { name: product.name });
    return { message: 'Product deleted', siteRefresh: SITE_REFRESH };
  },
});

// --- export (editor or owner: a bulk copy of personal data), server/route/admin/export.js
const field = (name) => ({ header: name, value: (row) => row[name] });
const idCol = { header: 'id', value: (row) => String(row._id) };
const EXPORTS = {
  orders: { rows: () => db.orders, cols: [
    idCol, { header: 'number', value: (o) => orderNumber(o._id) }, field('createdAt'), field('firstName'), field('lastName'), field('email'), field('phone'), field('street'), field('city'), field('state'), field('postal'),
    field('country'), field('totalPrice'), field('done'), field('paymentVerified'), field('paypalOrderId'),
    { header: 'products', value: (o) => (o.products ?? []).map((p) => `${p.productName ?? ''} x${p.quantity ?? ''}${p.color ? ` (${p.color})` : ''}`).join('; ') },
  ] },
  candles: { rows: () => db.candles, cols: [idCol, field('createdAt'), field('firstName'), field('lastName'), field('email'), field('prayer'), field('done')] },
  contacts: { rows: () => db.contacts, cols: [idCol, field('createdAt'), field('fullName'), field('email'), field('phone'), field('msg'), field('done')] },
  payments: { rows: () => db.payments, cols: [
    idCol, field('createdAt'), field('capturedAt'), field('paypalOrderId'), field('type'), field('status'), field('amount'), field('currency'), field('payerEmail'), field('payerName'), field('donorName'),
    { header: 'linkedKind', value: (p) => p.linkedTo?.kind }, { header: 'linkedId', value: (p) => (p.linkedTo?.id ? String(p.linkedTo.id) : '') },
    field('resolvedAt'), field('resolvedBy'), field('notes'),
  ] },
};
add({
  method: 'GET', path: '/admin/export/:file', min: 'editor',
  run: (ctx) => {
    const match = /^(orders|candles|contacts|payments)\.csv$/.exec(ctx.params.file);
    if (!match) throw new HttpError(404, 'Not found');
    const spec = EXPORTS[match[1]];
    let source = spec.rows();
    // payments.csv?status=unfulfilled: only the customers who paid and have nothing saved
    const status = ctx.url.searchParams.get('status');
    if (match[1] === 'payments' && status !== null) {
      if (status !== 'unfulfilled') throw new HttpError(400, 'Invalid status: use unfulfilled');
      source = unfulfilledPayments();
    }
    const rows = [...source].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10_000);
    record(ctx.req, `export.${match[1]}`, { type: match[1], id: '' }, { rows: rows.length });
    return { status: 200, raw: toCsv(spec.cols, rows, decodeEntities), headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${match[1]}-${new Date().toISOString().slice(0, 10)}.csv"` } };
  },
});

// --- users (owner only), server/route/admin/users.js
// server/route/admin/users.js emailRule / assertEmailFree
const accountEmail = (v, f) => {
  const text = str({ min: 0, max: 254, escape: false })(v, f).toLowerCase();
  if (text && (text.length > 254 || !EMAIL.test(text))) throw new HttpError(400, `Invalid ${f}: not an e-mail address`);
  return text;
};
const assertEmailFree = (email, exceptId = null) => {
  if (email && db.users.some((u) => u._id !== exceptId && (String(u.email ?? '').toLowerCase() === email || u.username.toLowerCase() === email))) {
    throw new HttpError(409, 'E-mail address already used by another account');
  }
};
const enabledOwners = (exceptId) => db.users.filter((u) => u._id !== exceptId && u.role === 'owner' && !u.disabled).length;
const isEnabledOwner = (u) => u.role === 'owner' && !u.disabled;
add({
  method: 'GET', path: '/admin/users', min: 'owner',
  run: (ctx) => {
    const page = paginate(ctx.url, db.users, {
      searchable: (u) => [u.username, u.email],
      statuses: { active: (u) => !u.disabled, owner: (u) => u.role === 'owner', editor: (u) => u.role === 'editor', viewer: (u) => u.role === 'viewer', disabled: (u) => u.disabled },
      sorts: ['createdAt', 'username', 'lastLoginAt'],
    });
    return { ...page, items: page.items.map(userItem) };
  },
});
add({
  method: 'POST', path: '/admin/users', min: 'owner',
  run: (ctx) => {
    const { username, password, role, email = '' } = parseBody(ctx.body, {
      username: str({ min: 3, max: 64, pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/, escape: false }),
      password: secret({ max: 200 }),
      role: oneOf(ROLES),
      email: opt(accountEmail),
    });
    const problem = passwordProblem(password, username);
    if (problem) throw new HttpError(400, problem);
    if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) throw new HttpError(409, 'Username already exists');
    assertEmailFree(email);
    const user = { _id: newId('7'), username, email, role, disabled: false, ...hashPassword(password), totpSecret: null, totpLastStep: -1, pendingTotp: null, failedLogins: 0, lockedUntil: null, lastLoginAt: null, createdAt: new Date().toISOString() };
    db.users.push(user);
    record(ctx.req, 'user.create', { type: 'user', id: user._id }, { username, role, email: Boolean(email) });
    return { status: 201, body: { item: userItem(user) } };
  },
});
add({
  method: 'PATCH', path: '/admin/users/:id', min: 'owner',
  run: (ctx) => {
    const id = objectId(ctx.params.id);
    const changes = parseBody(ctx.body, { role: opt(oneOf(ROLES)), disabled: opt(bool()), resetTotp: opt(bool()), unlock: opt(bool()), email: opt(accountEmail) });
    if (Object.keys(changes).length === 0) throw new HttpError(400, 'No fields to update');
    const target = found(byId(db.users, id), 'User');
    const self = id === ctx.req.auth.user._id;
    const newRole = changes.role ?? target.role;
    const demoting = newRole !== 'owner' || changes.disabled === true;
    if (self && (changes.disabled === true || newRole !== target.role)) throw new HttpError(400, 'You cannot disable yourself or change your own role');
    if (self && changes.resetTotp === true) throw new HttpError(400, 'Disable your own TOTP from your account settings');
    if (isEnabledOwner(target) && demoting && enabledOwners(id) === 0) throw new HttpError(409, 'The last owner cannot be demoted or disabled');
    const before = { role: target.role };
    if (changes.role !== undefined) target.role = changes.role;
    if (changes.disabled !== undefined) {
      target.disabled = changes.disabled;
      if (changes.disabled === false) Object.assign(target, { failedLogins: 0, lockedUntil: null });
    }
    if (changes.resetTotp === true) Object.assign(target, { totpSecret: null, pendingTotp: null, totpLastStep: -1 });
    if (changes.unlock === true) Object.assign(target, { failedLogins: 0, lockedUntil: null });
    if (changes.email !== undefined) {
      assertEmailFree(changes.email, id);
      target.email = changes.email;
    }
    if (changes.disabled === true || (changes.role !== undefined && changes.role !== before.role) || changes.resetTotp === true) revokeAll(id);
    record(ctx.req, 'user.update', { type: 'user', id }, {
      role: changes.role, disabled: changes.disabled, resetTotp: changes.resetTotp, unlock: changes.unlock,
      ...(changes.email !== undefined ? { email: changes.email ? 'changed' : 'removed' } : {}),
    });
    return { item: userItem(target) };
  },
});
add({
  method: 'DELETE', path: '/admin/users/:id', min: 'owner',
  run: (ctx) => {
    const id = objectId(ctx.params.id);
    if (id === ctx.req.auth.user._id) throw new HttpError(400, 'You cannot delete yourself');
    const index = db.users.findIndex((u) => u._id === id);
    const target = found(index >= 0 ? db.users[index] : null, 'User');
    if (isEnabledOwner(target) && enabledOwners(id) === 0) throw new HttpError(409, 'The last owner cannot be deleted');
    db.users.splice(index, 1);
    revokeAll(id);
    record(ctx.req, 'user.delete', { type: 'user', id }, { username: target.username });
    return { message: 'User deleted' };
  },
});

// --- audit (owner only), server/route/admin/audit.js
add({
  method: 'GET', path: '/admin/audit', min: 'owner',
  run: (ctx) => {
    const actor = ctx.url.searchParams.get('actor');
    const action = ctx.url.searchParams.get('action');
    if (actor !== null && (actor.length === 0 || actor.length > 100)) throw new HttpError(400, 'Invalid actor');
    if (action !== null && !/^[a-z0-9_.-]{1,60}$/.test(action)) throw new HttpError(400, 'Invalid action');
    let rows = audit;
    if (actor !== null) rows = rows.filter((e) => e.actorName === actor);
    if (action !== null) rows = rows.filter((e) => (action.endsWith('.') ? e.action.startsWith(action) : e.action === action));
    // sorted by `at`, newest first by default (paginate() sorts by the named key)
    const page = paginate(ctx.url, rows, { searchable: (e) => [e.actorName, e.action, e.target.id], sorts: ['at'], defaultSort: '-at' });
    // server/route/admin/audit.js withTargetNames: a user's username, a product's name, an order's number
    const nameOf = (e) => {
      const { type, id } = e.target ?? {};
      if (type === 'order' && id) return orderNumber(id);
      const recorded = typeof e.meta?.username === 'string' ? e.meta.username : typeof e.meta?.name === 'string' ? e.meta.name : null;
      if (type === 'user') return db.users.find((u) => u._id === id)?.username ?? recorded;
      if (type === 'product') return db.products.find((x) => x._id === id)?.name ?? recorded;
      return null;
    };
    return { ...page, items: page.items.map((e) => { const targetName = nameOf(e); return targetName ? { ...e, targetName } : e; }) };
  },
});

// --- privacy (owner only), server/route/admin/privacy.js: find and erase what is stored about an e-mail address
const ERASED_EMAIL = 'erased@erased.invalid';
// server/utils/validate.js isEmail
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const personalEmail = (value) => {
  const address = value.trim().toLowerCase();
  if (address.length > 254 || !EMAIL.test(address) || address === ERASED_EMAIL) throw new HttpError(400, 'Invalid email');
  return address;
};
const subjectRef = (address) => createHash('sha256').update(IP_SALT + address).digest('hex').slice(0, 32);
function privacyLimit(user) {
  const bucket = privacyBuckets.get(user._id) ?? { start: Date.now(), count: 0 };
  if (Date.now() - bucket.start > WINDOW_MS) Object.assign(bucket, { start: Date.now(), count: 0 });
  bucket.count += 1;
  privacyBuckets.set(user._id, bucket);
  if (bucket.count > 20) throw new HttpError(429, 'Too many privacy requests, please try again later.', { 'Retry-After': '60' });
}
const sameAddress = (stored, address) => String(stored ?? '').toLowerCase() === address; // contact messages and site reviews: any case
function privacyCounts(address) {
  return {
    orders: db.orders.filter((o) => o.email === address).length,
    candles: db.candles.filter((c) => c.email === address).length,
    contacts: db.contacts.filter((c) => sameAddress(c.email, address)).length,
    reviews: db.siteReviews.filter((r) => sameAddress(r.email, address)).length,
    payments: db.payments.filter((p) => p.payerEmail === address).length,
  };
}
add({
  method: 'POST', path: '/admin/privacy/lookup', min: 'owner',
  run: (ctx) => {
    privacyLimit(ctx.req.auth.user);
    const address = personalEmail(parseBody(ctx.body, { email: str({ min: 3, max: 254, escape: false }) }).email);
    const found = privacyCounts(address);
    record(ctx.req, 'privacy.lookup', { type: 'privacy', id: subjectRef(address) }, found);
    return { found };
  },
});
add({
  method: 'POST', path: '/admin/privacy/erase', min: 'owner',
  run: (ctx) => {
    privacyLimit(ctx.req.auth.user);
    const input = parseBody(ctx.body, { email: str({ min: 3, max: 254, escape: false }), confirm: str({ min: 3, max: 254, escape: false }) });
    const address = personalEmail(input.email);
    if (personalEmail(input.confirm) !== address) throw new HttpError(400, 'The confirmation does not match the address');
    const erasedAt = new Date().toISOString();
    const orders = db.orders.filter((o) => o.email === address);
    const candles = db.candles.filter((c) => c.email === address);
    const linked = new Set([...orders, ...candles].map((d) => d._id));
    const person = { firstName: 'Erased', lastName: 'Erased', email: ERASED_EMAIL, erasedAt };
    for (const o of orders) Object.assign(o, person, { phone: 'Erased', street: 'Erased', city: 'Erased', state: 'Erased', postal: 'Erased', country: 'Erased' });
    for (const c of candles) Object.assign(c, person, { prayer: 'Erased' });
    const contacts = db.contacts.filter((c) => sameAddress(c.email, address)).length;
    db.contacts = db.contacts.filter((c) => !sameAddress(c.email, address));
    const reviews = db.siteReviews.filter((r) => sameAddress(r.email, address)).length;
    db.siteReviews = db.siteReviews.filter((r) => !sameAddress(r.email, address));
    const payments = db.payments.filter((p) => p.payerEmail === address || (p.linkedTo?.id && linked.has(p.linkedTo.id)));
    for (const p of payments) { delete p.payerEmail; delete p.payerName; delete p.donorName; }
    const erased = { orders: orders.length, candles: candles.length, contacts, reviews, payments: payments.length };
    record(ctx.req, 'privacy.erase', { type: 'privacy', id: subjectRef(address) }, erased);
    return { erased };
  },
});

// --- live broadcasting (editor and owner), server/route/admin/live.js over a fake Cloudflare Stream: the WHIP address is
// given once, in the answer to start, and kept nowhere (like the real API).
const LIVE_MAX_MS = 6 * 60 * 60 * 1000;
const STREAM_HOST = 'https://customer-mock.cloudflarestream.com';
const liveView = (s) => s && ({
  _id: s._id, title: s.title, status: s.status, inputUid: s.inputUid, whepUrl: s.whepUrl,
  playbackUrl: `${STREAM_HOST}/${s.inputUid}/iframe`, startedAt: s.startedAt, endedAt: s.endedAt, endReason: s.endReason,
  startedBy: { ...s.startedBy }, endedBy: s.endedBy ? { ...s.endedBy } : null, inputDeleted: s.inputDeleted,
});
const liveNow = () => live.sessions.find((s) => s.status === 'live') ?? null;
function endLive(req, session, reason, user) {
  if (session.status !== 'live') return null;
  const now = Date.now();
  Object.assign(session, { status: 'ended', endedAt: new Date(now).toISOString(), endReason: reason, endedBy: user ? { id: user._id, name: user.username } : { id: null, name: 'system' } });
  session.inputDeleted = live.inputs.delete(session.inputUid);
  const minutes = Math.max(0, Math.round((now - new Date(session.startedAt).getTime()) / 60_000));
  // The scheduled broadcast it fulfilled is done (server/services/liveSchedule.js finishScheduledFor).
  for (const item of live.schedule) if (item.liveSession === session._id && item.status === 'live') Object.assign(item, { status: 'done', updatedAt: new Date(now).toISOString() });
  record(req, reason === 'auto' ? 'live.auto_end' : 'live.stop', { type: 'live', id: session._id }, { reason, minutes, inputDeleted: session.inputDeleted }, user ?? { username: 'system', role: 'system' });
  return session;
}
function endStaleLive(req) {
  for (const s of live.sessions) if (s.status === 'live' && new Date(s.startedAt).getTime() < Date.now() - LIVE_MAX_MS) endLive(req, s, 'auto', null);
}
const hex = (bytes) => randomBytes(bytes).toString('hex');

add({
  method: 'GET', path: '/admin/live', min: 'editor',
  run: (ctx) => {
    endStaleLive(ctx.req);
    const history = [...live.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 10);
    return { configured: live.configured, maxMinutes: LIVE_MAX_MS / 60_000, current: liveView(liveNow()), history: history.map(liveView) };
  },
});
add({
  method: 'POST', path: '/admin/live/start', min: 'editor',
  run: (ctx) => {
    const { title, scheduleId } = parseBody(ctx.body, { title: str({ min: 1, max: 120 }), scheduleId: opt(str({ min: 24, max: 24, pattern: /^[a-f0-9]{24}$/i, escape: false })) });
    if (!live.configured) return { status: 503, body: { error: 'Live broadcasting is not configured yet (CF_ACCOUNT_ID and CF_STREAM_API_TOKEN, docs/LIVE.md)' } };
    endStaleLive(ctx.req);
    const current = liveNow();
    if (current) return { status: 409, body: { error: 'A broadcast is already live', current: liveView(current) } };
    // The scheduled broadcast this one fulfils, checked before Cloudflare is asked for anything.
    const planned = scheduleId ? live.schedule.find((s) => s._id === scheduleId.toLowerCase()) : null;
    if (scheduleId && !planned) return { status: 404, body: { error: 'Scheduled broadcast not found' } };
    if (planned && planned.status !== 'scheduled') return { status: 409, body: { error: 'That scheduled broadcast is not waiting to start (it is live, done or cancelled)' } };
    if (live.failCreate) {
      record(ctx.req, 'live.start_failed', { type: 'live', id: '' }, { stage: 'cloudflare' });
      return { status: 502, body: { error: 'Cloudflare Stream could not prepare the broadcast. Try again in a moment.' } };
    }
    const inputUid = hex(16);
    const whipUrl = `${STREAM_HOST}/${hex(32)}/webRTC/publish`;
    live.inputs.set(inputUid, true);
    const user = ctx.req.auth.user;
    const session = {
      _id: newId('5'), title, status: 'live', inputUid, whepUrl: `${STREAM_HOST}/${inputUid}/webRTC/play`, startedAt: new Date().toISOString(),
      endedAt: null, endReason: null, startedBy: { id: user._id, name: user.username }, endedBy: null, inputDeleted: false,
    };
    live.sessions.push(session);
    const linked = Boolean(planned && planned.status === 'scheduled');
    if (linked) Object.assign(planned, { status: 'live', liveSession: session._id, updatedAt: new Date().toISOString() });
    record(ctx.req, 'live.start', { type: 'live', id: session._id }, { title, inputUid, ...(scheduleId ? { scheduleId: scheduleId.toLowerCase(), scheduleLinked: linked } : {}) });
    return { status: 201, body: { session: liveView(session), whipUrl } };
  },
});
add({
  method: 'POST', path: '/admin/live/stop', min: 'editor',
  run: (ctx) => {
    const body = parseBody(ctx.body ?? {}, { sessionId: opt(str({ min: 24, max: 24, pattern: /^[a-f0-9]{24}$/i, escape: false })), force: opt(bool()) });
    const current = liveNow();
    if (!current || (body.sessionId && current._id !== body.sessionId.toLowerCase())) return { stopped: false, session: null };
    const user = ctx.req.auth.user;
    const mine = current.startedBy.id === user._id;
    if (!mine) {
      if (user.role !== 'owner') throw new HttpError(403, 'Only the person who started this broadcast, or an owner, can end it');
      if (body.force !== true) return { status: 409, body: { error: 'Someone else started this broadcast. Confirm to end it.', current: liveView(current) } };
    }
    const ended = endLive(ctx.req, current, mine ? 'stopped' : 'forced', user);
    return { stopped: Boolean(ended), session: liveView(ended) };
  },
});
// The public status the website polls (server/route/liveRoute.js).
add({
  method: 'GET', path: '/live/status', public: true,
  run: (ctx) => {
    endStaleLive(ctx.req);
    const current = liveNow();
    return current
      ? { live: true, id: current._id, title: current.title, startedAt: current.startedAt, playbackUrl: `${STREAM_HOST}/${current.inputUid}/iframe` }
      : { live: false };
  },
});

// --- recordings of broadcasts (editor and owner), server/route/admin/liveRecordings.js over the fake Cloudflare's stored
// videos: the browser uploads straight to Cloudflare (tus), the API never sees the file and never keeps the upload address.
const NOT_CONFIGURED = 'Live broadcasting is not configured yet (CF_ACCOUNT_ID and CF_STREAM_API_TOKEN, docs/LIVE.md)';
const MAX_VIDEO_SECONDS = 21_600;
const MAX_UPLOAD_BYTES = 30 * 1024 ** 3;
const UPLOAD_WINDOW_MS = 4 * 3600_000;
const CHECK_EVERY_MS = 10_000;
const UPLOAD_GIVE_UP_MS = 48 * 3600_000;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const MIME = /^video\/(mp4|webm|x-matroska)(;[ a-z0-9=.,"-]{0,80})?$/i;
const SYSTEM_ACTOR = { username: 'system', role: 'system' };
const mimeRule = str({ min: 7, max: 100, pattern: MIME, escape: false });
const sizeRule = int({ min: 1, max: MAX_UPLOAD_BYTES });
const durationRule = int({ min: 0, max: MAX_VIDEO_SECONDS });
const idParam = (ctx) => (OBJECT_ID.test(ctx.params.id ?? '') ? ctx.params.id.toLowerCase() : null);
const customerCodeOf = (address) => /^https:\/\/customer-([a-z0-9]{1,64})\.cloudflarestream\.com\//.exec(String(address ?? ''))?.[1] ?? null;
const videoUrl = (code, uid, path) => (/^[a-z0-9]{1,64}$/.test(code ?? '') && /^[a-f0-9]{32}$/.test(uid ?? '') ? `https://customer-${code}.cloudflarestream.com/${uid}/${path}` : null);
const mayUpload = (user, startedById) => user.role === 'owner' || String(startedById ?? '') === user._id;
const maxDurationFor = (seconds) => Math.min(MAX_VIDEO_SECONDS, Math.max(300, Math.ceil((seconds || 0) * 1.2) + 300));

const recordingView = (r) => r && ({
  _id: r._id, session: r.session, title: r.title, liveStartedAt: r.liveStartedAt, liveEndedAt: r.liveEndedAt ?? null,
  durationSeconds: Math.max(0, Math.round(r.durationSeconds || 0)), sizeBytes: r.sizeBytes, mimeType: r.mimeType, cfVideoUid: r.cfVideoUid,
  status: r.status, failReason: r.failReason ?? null, published: Boolean(r.published), publishedAt: r.publishedAt ?? null,
  thumbnailUrl: videoUrl(r.customerCode, r.cfVideoUid, 'thumbnails/thumbnail.jpg'), playbackUrl: videoUrl(r.customerCode, r.cfVideoUid, 'iframe'),
  createdBy: { ...r.createdBy }, createdAt: r.createdAt,
});

// The fake Cloudflare (server/test-harness/fake-cloudflare.js): one-time upload addresses and stored videos.
function createUpload(sizeBytes, maxDurationSeconds) {
  if (live.failUpload) throw new HttpError(502, 'Cloudflare Stream could not prepare the upload. Try again in a moment.');
  const uid = hex(16);
  live.videos.set(uid, { sizeBytes, maxDurationSeconds, state: 'pendingupload', readyToStream: false, durationSeconds: null });
  return { uid, uploadUrl: `https://upload.videodelivery.net/tus/${uid}?tusv2=true` };
}
const deleteVideo = (uid) => { if (!live.configured || !uid) return false; live.videos.delete(uid); return true; };
function setVideoState(uid, state, durationSeconds) {
  const video = live.videos.get(uid);
  if (!video) return;
  video.state = state;
  video.readyToStream = state === 'ready';
  if (durationSeconds !== undefined) video.durationSeconds = durationSeconds;
  else if (state === 'ready' && video.durationSeconds === null) video.durationSeconds = Math.min(video.maxDurationSeconds ?? 60, 60);
}

/** Asks the fake Cloudflare how far a video is (services/liveRecordings.js refreshRecording): never backwards. */
function refreshRecording(r, now = Date.now()) {
  if (!live.configured || !['uploading', 'processing'].includes(r.status)) return r;
  const video = live.videos.get(r.cfVideoUid);
  const before = r.status;
  let next = r.status;
  r.checkedAt = now;
  if (!video) {
    if (r.status === 'processing' || now - new Date(r.createdAt).getTime() > UPLOAD_GIVE_UP_MS) { next = 'failed'; r.failReason = 'missing at Cloudflare'; }
  } else {
    if (video.state === 'error') { next = 'failed'; r.failReason = 'Cloudflare could not encode it (ERR_NON_VIDEO)'; }
    else if (video.state === 'ready' && video.readyToStream) next = 'ready';
    else if (['downloading', 'queued', 'inprogress', 'ready'].includes(video.state)) next = 'processing';
    if (video.durationSeconds !== null && video.durationSeconds > 0) r.durationSeconds = video.durationSeconds;
  }
  if (next === 'failed') r.published = false;
  if (next !== before) {
    r.status = next;
    r.updatedAt = new Date(now).toISOString();
    record({ headers: {}, socket: {} }, 'live.recording_status', { type: 'liveRecording', id: r._id }, { from: before, to: next, videoUid: r.cfVideoUid }, SYSTEM_ACTOR);
  }
  return r;
}

/** Minutes stored (the fake's own figure when configured, else our estimate), cached a minute like the real API. */
function storageSummary(now = Date.now()) {
  if (live.storageCache && now - live.storageCache.at < 60_000) return live.storageCache.body;
  let body;
  if (live.configured) {
    const seconds = [...live.videos.values()].reduce((sum, v) => sum + (v.durationSeconds ?? 0), 0);
    body = { usedMinutes: Math.round(seconds / 60), limitMinutes: 1000, videos: live.videos.size, source: 'cloudflare' };
  } else {
    const kept = live.recordings.filter((r) => ['processing', 'ready'].includes(r.status));
    body = { usedMinutes: Math.round(kept.reduce((s, r) => s + (r.durationSeconds || 0), 0) / 60), limitMinutes: 1000, videos: kept.length, source: 'estimate' };
  }
  body.pricePer1000Minutes = 5;
  live.storageCache = { at: now, body };
  return body;
}

function newUpload(req, { title, sizeBytes, durationSeconds }) {
  try {
    return { ...createUpload(sizeBytes, maxDurationFor(durationSeconds)), expiresAt: new Date(Date.now() + UPLOAD_WINDOW_MS).toISOString(), name: `Nazareth Holy Cross: ${title}`.slice(0, 100) };
  } catch (error) {
    record(req, 'live.recording_failed', { type: 'liveRecording', id: '' }, { stage: 'cloudflare' });
    throw error;
  }
}
const recordingById = (id) => found(live.recordings.find((r) => r._id === id), 'Recording');
const forbiddenUpload = () => new HttpError(403, 'Only the person who made this broadcast, or an owner, can upload its recording');
const notFoundRecording = () => new HttpError(404, 'Recording not found');

add({
  method: 'GET', path: '/admin/live/recordings', min: 'editor',
  run: () => {
    const now = Date.now();
    const items = [...live.recordings].sort((a, b) => b.liveStartedAt.localeCompare(a.liveStartedAt) || b._id.localeCompare(a._id)).slice(0, 100);
    items.filter((r) => ['uploading', 'processing'].includes(r.status) && (!r.checkedAt || now - r.checkedAt >= CHECK_EVERY_MS)).slice(0, 10).forEach((r) => refreshRecording(r, now));
    return { configured: live.configured, items: items.map(recordingView), storage: storageSummary(now) };
  },
});
add({
  method: 'POST', path: '/admin/live/recordings', min: 'editor',
  run: (ctx) => {
    const body = parseBody(ctx.body, { sessionId: str({ min: 24, max: 24, pattern: OBJECT_ID, escape: false }), sizeBytes: sizeRule, durationSeconds: durationRule, mimeType: mimeRule, title: opt(str({ min: 1, max: 120 })) });
    if (!live.configured) return { status: 503, body: { error: NOT_CONFIGURED } };
    const session = live.sessions.find((s) => s._id === body.sessionId.toLowerCase());
    if (!session) return { status: 404, body: { error: 'Broadcast not found' } };
    const user = ctx.req.auth.user;
    if (!mayUpload(user, session.startedBy.id)) throw new HttpError(403, 'Only the person who made this broadcast, or an owner, can upload its recording');
    const existing = live.recordings.find((r) => r.session === session._id);
    if (existing) return { status: 409, body: { error: 'This broadcast already has a recording', recording: recordingView(existing) } };
    const title = body.title ?? session.title;
    const upload = newUpload(ctx.req, { title, sizeBytes: body.sizeBytes, durationSeconds: body.durationSeconds });
    const now = new Date().toISOString();
    const r = {
      _id: newId('4'), session: session._id, title, liveStartedAt: session.startedAt, liveEndedAt: session.endedAt ?? null, durationSeconds: body.durationSeconds,
      sizeBytes: body.sizeBytes, mimeType: body.mimeType, cfVideoUid: upload.uid, customerCode: customerCodeOf(session.whepUrl) ?? '', status: 'uploading',
      failReason: null, published: false, publishedAt: null, uploadExpiresAt: upload.expiresAt, checkedAt: null, createdBy: { id: user._id, name: user.username },
      createdAt: now, updatedAt: now,
    };
    live.recordings.push(r);
    record(ctx.req, 'live.recording_create', { type: 'liveRecording', id: r._id }, { session: session._id, videoUid: upload.uid, sizeMb: Math.round(body.sizeBytes / 1048576), durationSeconds: body.durationSeconds });
    return { status: 201, body: { recordingId: r._id, uploadUrl: upload.uploadUrl, recording: recordingView(r) } };
  },
});
add({
  method: 'POST', path: '/admin/live/recordings/:id/upload-url', min: 'editor',
  run: (ctx) => {
    const id = idParam(ctx);
    if (!id) throw notFoundRecording();
    const body = parseBody(ctx.body ?? {}, { sizeBytes: sizeRule, durationSeconds: opt(durationRule), mimeType: opt(mimeRule) });
    if (!live.configured) return { status: 503, body: { error: NOT_CONFIGURED } };
    const r = recordingById(id);
    const session = live.sessions.find((s) => s._id === r.session);
    if (!mayUpload(ctx.req.auth.user, session?.startedBy?.id ?? r.createdBy?.id)) throw forbiddenUpload();
    if (!['uploading', 'failed'].includes(r.status)) return { status: 409, body: { error: 'This recording has already been uploaded', recording: recordingView(r) } };
    const durationSeconds = body.durationSeconds ?? r.durationSeconds;
    const upload = newUpload(ctx.req, { title: r.title, sizeBytes: body.sizeBytes, durationSeconds });
    const oldUid = r.cfVideoUid;
    Object.assign(r, {
      cfVideoUid: upload.uid, status: 'uploading', failReason: null, published: false, publishedAt: null, sizeBytes: body.sizeBytes, durationSeconds,
      ...(body.mimeType ? { mimeType: body.mimeType } : {}), uploadExpiresAt: upload.expiresAt, checkedAt: null, updatedAt: new Date().toISOString(),
    });
    const oldDeleted = deleteVideo(oldUid);
    record(ctx.req, 'live.recording_renew', { type: 'liveRecording', id: r._id }, { videoUid: upload.uid, oldVideoUid: oldUid, oldDeleted });
    return { recordingId: r._id, uploadUrl: upload.uploadUrl, recording: recordingView(r) };
  },
});
add({
  method: 'POST', path: '/admin/live/recordings/:id/uploaded', min: 'editor',
  run: (ctx) => {
    const id = idParam(ctx);
    if (!id) throw notFoundRecording();
    parseBody(ctx.body ?? {}, {});
    const r = recordingById(id);
    const session = live.sessions.find((s) => s._id === r.session);
    if (!mayUpload(ctx.req.auth.user, session?.startedBy?.id ?? r.createdBy?.id)) throw forbiddenUpload();
    if (r.status !== 'uploading') {
      if (r.status === 'failed') return { status: 409, body: { error: 'This recording failed. Upload it again.', recording: recordingView(r) } };
      return { recording: recordingView(r) };
    }
    Object.assign(r, { status: 'processing', checkedAt: null, updatedAt: new Date().toISOString() });
    record(ctx.req, 'live.recording_uploaded', { type: 'liveRecording', id: r._id }, { videoUid: r.cfVideoUid });
    return { recording: recordingView(refreshRecording(r)) };
  },
});
add({
  method: 'PATCH', path: '/admin/live/recordings/:id', min: 'editor',
  run: (ctx) => {
    const id = idParam(ctx);
    if (!id) throw notFoundRecording();
    const body = parseBody(ctx.body, { title: opt(str({ min: 1, max: 120 })), published: opt(bool()) });
    if (body.title === undefined && body.published === undefined) throw new HttpError(400, 'Nothing to change');
    const r = recordingById(id);
    if (body.published === true && r.status !== 'ready') {
      refreshRecording(r);
      if (r.status !== 'ready') return { status: 409, body: { error: 'The recording is not ready yet: it can be published once Cloudflare has processed it', recording: recordingView(r) } };
    }
    if (body.title !== undefined) r.title = body.title;
    if (body.published !== undefined && body.published !== r.published) Object.assign(r, { published: body.published, publishedAt: body.published ? new Date().toISOString() : null });
    r.updatedAt = new Date().toISOString();
    record(ctx.req, 'live.recording_update', { type: 'liveRecording', id: r._id }, { ...(body.title !== undefined ? { title: body.title } : {}), ...(body.published !== undefined ? { published: body.published } : {}) });
    return { recording: recordingView(r) };
  },
});
add({
  method: 'DELETE', path: '/admin/live/recordings/:id', min: 'editor',
  run: (ctx) => {
    const id = idParam(ctx);
    if (!id) throw notFoundRecording();
    const r = recordingById(id);
    live.recordings = live.recordings.filter((x) => x !== r);
    const cloudflareDeleted = deleteVideo(r.cfVideoUid);
    record(ctx.req, 'live.recording_delete', { type: 'liveRecording', id: r._id }, { title: r.title, videoUid: r.cfVideoUid, published: Boolean(r.published), cloudflareDeleted });
    return { deleted: true, cloudflareDeleted };
  },
});
// The website's past broadcasts (server/route/liveRoute.js): published and ready, newest first.
add({
  method: 'GET', path: '/live/recordings', public: true,
  run: () => ({
    items: [...live.recordings].filter((r) => r.published && r.status === 'ready').sort((a, b) => b.liveStartedAt.localeCompare(a.liveStartedAt)).slice(0, 50)
      .map((r) => ({ id: r._id, title: r.title, date: r.liveStartedAt, durationSeconds: Math.round(r.durationSeconds || 0), thumbnailUrl: videoUrl(r.customerCode, r.cfVideoUid, 'thumbnails/thumbnail.jpg'), playbackUrl: videoUrl(r.customerCode, r.cfVideoUid, 'iframe') }))
      .filter((r) => r.thumbnailUrl && r.playbackUrl),
  }),
});

// --- scheduled broadcasts (editor and owner), server/route/admin/liveSchedule.js: typed in Nazareth time, stored in UTC
const HOUR_MS = 3600_000;
const nazarethWall = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const wallClockAt = (ms) => {
  const p = Object.fromEntries(nazarethWall.formatToParts(new Date(ms)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
};
const nazarethOffsetAt = (ms) => wallClockAt(ms) - Math.floor(ms / 1000) * 1000;
// services/liveSchedule.js nazarethToUtc: a skipped time moves forward by the gap, a repeated one is the first.
function nazarethToUtc(local) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(local ?? ''));
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  const candidates = [...new Set([nazarethOffsetAt(wall - 24 * HOUR_MS), nazarethOffsetAt(wall + 24 * HOUR_MS)])].map((o) => wall - o).filter((t) => wallClockAt(t) === wall).sort((a, b) => a - b);
  if (candidates.length) return new Date(candidates[0]);
  return new Date(wall - nazarethOffsetAt(wall - 24 * HOUR_MS));
}
const utcToNazarethLocal = (value) => new Date(wallClockAt(new Date(value).getTime())).toISOString().slice(0, 16);
const SCHEDULE_PAST_MS = 5 * 60_000; // the time it takes to fill in the form
const SCHEDULE_AHEAD_MS = 400 * 24 * HOUR_MS;
function startsAtFrom(local, now = Date.now()) {
  const date = nazarethToUtc(local);
  if (!date) throw new HttpError(400, 'Invalid startsAtLocal: a date and time like 2026-10-20T19:30 (Nazareth time)');
  if (date.getTime() < now - SCHEDULE_PAST_MS) throw new HttpError(400, 'Invalid startsAtLocal: the time has already passed');
  if (date.getTime() > now + SCHEDULE_AHEAD_MS) throw new HttpError(400, 'Invalid startsAtLocal: at most a year ahead');
  return date;
}
const scheduleView = (s) => s && ({
  _id: s._id, title: s.title, description: s.description ?? '', startsAt: s.startsAt, startsAtLocal: utcToNazarethLocal(s.startsAt), timeZone: TIME_ZONE,
  published: Boolean(s.published), status: s.status, liveSession: s.liveSession ?? null, createdBy: { ...s.createdBy }, updatedAt: s.updatedAt,
});
const localRule = str({ min: 16, max: 16, pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, escape: false });
const descriptionRule = str({ min: 0, max: 500, multiline: true });
const notFoundSchedule = () => new HttpError(404, 'Scheduled broadcast not found');

add({
  method: 'GET', path: '/admin/live/schedule', min: 'editor',
  run: () => {
    const from = Date.now() - 7 * 24 * HOUR_MS;
    const items = live.schedule.filter((s) => s.status === 'live' || new Date(s.startsAt).getTime() >= from)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a._id.localeCompare(b._id)).slice(0, 100);
    return { timeZone: TIME_ZONE, items: items.map(scheduleView) };
  },
});
add({
  method: 'POST', path: '/admin/live/schedule', min: 'editor',
  run: (ctx) => {
    const body = parseBody(ctx.body, { title: str({ min: 1, max: 120 }), description: opt(descriptionRule), startsAtLocal: localRule, published: opt(bool()) });
    const startsAt = startsAtFrom(body.startsAtLocal).toISOString();
    const user = ctx.req.auth.user;
    const who = { id: user._id, name: user.username };
    const now = new Date().toISOString();
    const s = { _id: newId('3'), title: body.title, description: body.description ?? '', startsAt, published: body.published ?? false, status: 'scheduled', liveSession: null, createdBy: who, updatedBy: who, createdAt: now, updatedAt: now };
    live.schedule.push(s);
    record(ctx.req, 'live.schedule_create', { type: 'scheduledBroadcast', id: s._id }, { title: s.title, startsAt, published: s.published });
    return { status: 201, body: { item: scheduleView(s) } };
  },
});
add({
  method: 'PATCH', path: '/admin/live/schedule/:id', min: 'editor',
  run: (ctx) => {
    const id = idParam(ctx);
    if (!id) throw notFoundSchedule();
    const body = parseBody(ctx.body, { title: opt(str({ min: 1, max: 120 })), description: opt(descriptionRule), startsAtLocal: opt(localRule), published: opt(bool()), status: opt(oneOf(['scheduled', 'cancelled'])) });
    if (Object.keys(body).length === 0) throw new HttpError(400, 'Nothing to change');
    const s = live.schedule.find((x) => x._id === id);
    if (!s) throw notFoundSchedule();
    const set = {};
    if (body.title !== undefined) set.title = body.title;
    if (body.description !== undefined) set.description = body.description;
    if (body.published !== undefined) set.published = body.published;
    if (body.startsAtLocal !== undefined || body.status !== undefined) {
      if (!['scheduled', 'cancelled'].includes(s.status)) return { status: 409, body: { error: 'This broadcast has already started: its time and status can no longer be changed', item: scheduleView(s) } };
      if (body.startsAtLocal !== undefined) set.startsAt = startsAtFrom(body.startsAtLocal).toISOString();
      if (body.status !== undefined) set.status = body.status;
    }
    const user = ctx.req.auth.user;
    Object.assign(s, set, { updatedBy: { id: user._id, name: user.username }, updatedAt: new Date().toISOString() });
    const meta = {};
    for (const key of ['title', 'published', 'status']) if (set[key] !== undefined) meta[key] = set[key];
    if (set.description !== undefined) meta.description = true;
    if (set.startsAt) meta.startsAt = set.startsAt;
    record(ctx.req, 'live.schedule_update', { type: 'scheduledBroadcast', id: s._id }, meta);
    return { item: scheduleView(s) };
  },
});
add({
  method: 'DELETE', path: '/admin/live/schedule/:id', min: 'editor',
  run: (ctx) => {
    const id = idParam(ctx);
    if (!id) throw notFoundSchedule();
    const s = live.schedule.find((x) => x._id === id);
    if (!s) throw notFoundSchedule();
    if (s.status === 'live') return { status: 409, body: { error: 'This broadcast is live now. End it first.' } };
    live.schedule = live.schedule.filter((x) => x !== s);
    record(ctx.req, 'live.schedule_delete', { type: 'scheduledBroadcast', id: s._id }, { title: s.title, startsAt: s.startsAt, status: s.status });
    return { deleted: true };
  },
});
// The website's upcoming broadcasts: published, still to come (or started less than two hours ago, or live).
add({
  method: 'GET', path: '/live/schedule', public: true,
  run: () => ({
    timeZone: TIME_ZONE,
    items: live.schedule.filter((s) => s.published && ['scheduled', 'live'].includes(s.status) && new Date(s.startsAt).getTime() > Date.now() - 2 * HOUR_MS)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 10)
      .map((s) => ({ id: s._id, title: s.title, description: s.description ?? '', startsAt: s.startsAt, status: s.status })),
  }),
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
      // { "accounts": false }: no admin account at all, the state in which a reset request creates the first owner.
      if (req.method === 'POST' && url.pathname === '/__mock/reset') { const b = await readBody(req); reset({ accounts: b.accounts !== false }); return send(req, res, 200, { ok: true }); }
      if (req.method === 'GET' && url.pathname === '/__mock/emails') return send(req, res, 200, emails);
      if (req.method === 'POST' && url.pathname === '/__mock/mail') { const b = await readBody(req); failMail = b.fail === true; return send(req, res, 200, { ok: true, fail: failMail }); }
      if (req.method === 'GET' && url.pathname === '/__mock/health') return send(req, res, 200, { ok: true });
      if (req.method === 'POST' && url.pathname === '/__mock/busy') { const b = await readBody(req); busyMe = Number.isInteger(b.count) ? b.count : 0; return send(req, res, 200, { ok: true, busy: busyMe }); }
      // Live broadcasting, like the harness (server/test-harness/control.js): { configured: false } = no Cloudflare
      // credentials on the server; { failCreate: true } = Cloudflare refuses an input, { failUpload: true } an upload
      // address; { videoState: 'queued' | 'inprogress' | 'ready' | 'error', videoUid?, durationSeconds? } moves a stored
      // video (every one when no uid is given) through Cloudflare's processing, as if it had been uploaded.
      const liveState = () => ({ ok: true, inputs: live.inputs.size, videos: [...live.videos.entries()].map(([uid, v]) => ({ uid, state: v.state, sizeBytes: v.sizeBytes })) });
      if (req.method === 'GET' && url.pathname === '/__mock/live') return send(req, res, 200, liveState());
      if (req.method === 'POST' && url.pathname === '/__mock/live') {
        const b = await readBody(req);
        if (typeof b.configured === 'boolean') live.configured = b.configured;
        if (typeof b.failCreate === 'boolean') live.failCreate = b.failCreate;
        if (typeof b.failUpload === 'boolean') live.failUpload = b.failUpload;
        if (['pendingupload', 'queued', 'inprogress', 'ready', 'error'].includes(b.videoState)) {
          const duration = Number.isInteger(b.durationSeconds) && b.durationSeconds >= 0 ? b.durationSeconds : undefined;
          for (const uid of typeof b.videoUid === 'string' ? [b.videoUid] : [...live.videos.keys()]) setVideoState(uid, b.videoState, duration);
        }
        live.storageCache = null;
        return send(req, res, 200, liveState());
      }
      return send(req, res, 404, { error: 'Not found' });
    }

    if (busyMe > 0 && req.method === 'GET' && url.pathname === '/admin/auth/me') {
      busyMe -= 1;
      res.setHeader('Retry-After', '120');
      return send(req, res, 429, { error: 'Too many requests, please slow down.' });
    }

    let route;
    let match;
    for (const r of compiled) {
      if (r.method !== req.method) continue;
      match = r.regex.exec(url.pathname);
      if (match) { route = r; break; }
    }
    if (!route) throw new HttpError(404, 'Not found');

    const params = {};
    route.names.forEach((n, i) => { params[n] = decodeURIComponent(match[i + 1]); });
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};

    if (!route.public) authenticate(req, route);
    const result = await route.run({ req, url, params, body });
    if (result === 204) return send(req, res, 204, null);
    if (result && typeof result === 'object' && 'raw' in result) return send(req, res, result.status ?? 200, result.raw, result.headers);
    if (result && typeof result === 'object' && 'status' in result && 'body' in result) return send(req, res, result.status, result.body);
    return send(req, res, 200, result);
  } catch (error) {
    if (error instanceof HttpError) return send(req, res, error.status, { error: error.message }, error.headers);
    console.error('[mock-api] unexpected error', error);
    return send(req, res, 500, { error: 'Internal server error' });
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, '127.0.0.1', () => console.log(`[mock-api] admin API contract on http://localhost:${PORT}`));
}
