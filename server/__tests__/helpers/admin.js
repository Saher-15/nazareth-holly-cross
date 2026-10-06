import request from 'supertest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import mongoose from 'mongoose';
import { fakes, oid, quickHash } from './fakes.js';

// Shared setup for the admin API tests (the models are replaced by helpers/fakes.js in each test file).

export const PASSWORD = 'correct horse battery';

// One HTTP server per test file, reused by every request (supertest would otherwise open a socket per request,
// which on Windows runs out of buffer space in a large suite).
export function startClient(app) {
  const server = app.listen(0, '127.0.0.1');
  return { http: request(server), close: () => new Promise((resolve) => server.close(resolve)) };
}

let ipCounter = 0;
// A fresh client address, so the per-IP rate limiters never leak between tests.
export const freshIp = () => `10.9.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;

// An admin account in the fake database (cost-4 hash of PASSWORD unless told otherwise).
export function seedAdmin(overrides = {}) {
  const [admin] = fakes.Admin.seed([{ username: `user${oid().slice(-6)}`, password: quickHash(PASSWORD), ...overrides }]);
  return admin;
}

// A signed-in session for an account: the live session document and a real token (services/adminSessions.js).
export async function signedIn(signSessionToken, overrides = {}) {
  const admin = seedAdmin(overrides);
  const sid = `sid-${oid()}`;
  fakes.AdminSession.seed([{ sid, admin: admin._id, expiresAt: new Date(Date.now() + 3600_000), revokedAt: null }]);
  const token = signSessionToken({ id: admin._id, role: admin.role }, sid);
  return { admin, sid, token, auth: { Authorization: `Bearer ${token}` } };
}

// ---- Query filters and mongoose's sanitizeFilter ----
// The server runs Mongoose with sanitizeFilter (config/mongoose.js): an operator object used as a value
// ({ role: { $exists: false } }) silently becomes an equality test unless it is marked mongoose.trusted(). The
// fake models do not do that, so tests check it here: every filter the routes sent must come out of
// mongoose.sanitizeFilter unchanged.
const cloneKeepingMarks = (value) => {
  if (Array.isArray(value)) return value.map(cloneKeepingMarks);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const key of Reflect.ownKeys(value)) out[key] = cloneKeepingMarks(value[key]);
    return out;
  }
  return value;
};

export const sanitizeChanges = (filter) => {
  const before = cloneKeepingMarks(filter);
  const after = mongoose.sanitizeFilter(cloneKeepingMarks(filter));
  return JSON.stringify(before) === JSON.stringify(after) ? null : { before, after };
};

// Every filter recorded by the fake models (find, findOne, counts, updates, deletes).
export const allFilters = () =>
  Object.entries(fakes).flatMap(([name, Model]) => Model.calls.filter((c) => c.filter).map((c) => ({ name, op: c.op, filter: c.filter })));
// ---- Casting against the REAL schemas ----
// The fakes accept any filter. Here each recorded filter is cast by the real Mongoose model (with the server's
// sanitizeFilter and strictQuery settings), which proves the fields exist in the schema and the values are castable.
const MODEL_FILES = {
  Order: 'order', Candle: 'candle', Contact: 'contact', Review: 'review', ProductReview: 'productReview',
  Prayer: 'prayer', Product: 'product', Admin: 'admin', AdminSession: 'adminSession', AuditLog: 'auditLog', Payment: 'payment',
};
const modelDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../model');

export async function castProblem(name, filter) {
  mongoose.set('sanitizeFilter', true);
  mongoose.set('strictQuery', true);
  const Real = (await vi.importActual(path.join(modelDir, `${MODEL_FILES[name]}.js`))).default;
  const query = Real.find(cloneKeepingMarks(filter));
  const before = JSON.stringify(cloneKeepingMarks(filter));
  try {
    query._castConditions();
  } catch (error) {
    return `${error.name}: ${error.message}`;
  }
  if (query.error()) return `${query.error().name}: ${query.error().message}`;
  const after = JSON.stringify(query.getFilter());
  return after === before ? null : `the filter changed while casting: ${before} -> ${after}`;
}