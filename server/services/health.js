import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import { config } from '../config/env.js';

// The answer of GET /health/deep: is the API up AND can it reach its database? (GET /health only says the process
// answers; it stays 200 even while MongoDB Atlas refuses the connection, e.g. an IP allowlist that blocks Render.)
//
// Nothing secret is ever put in the answer: no connection string, host, user name, error text or key. A failed check
// says only "timeout" or "error".

export const PING_TIMEOUT_MS = 2000;
// One database ping serves every request of the same few seconds, so a script hammering this public address cannot
// turn it into load on the database.
export const CACHE_MS = 5000;

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
const startedAt = new Date();

let version = 'unknown';
try {
  version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version ?? 'unknown';
} catch {
  /* the version is informational only */
}

/** Pings the database with a deadline. Resolves, never throws, and says nothing about hosts or credentials. */
export async function pingDatabase(connection = mongoose.connection, timeoutMs = PING_TIMEOUT_MS) {
  if (connection.readyState !== 1 || !connection.db) {
    return { status: 'down', state: STATES[connection.readyState] ?? 'unknown' };
  }
  const started = performance.now();
  let timer;
  try {
    await Promise.race([
      connection.db.admin().ping(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    return { status: 'up', state: 'connected', latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    return { status: 'down', state: 'connected', reason: err.message === 'timeout' ? 'timeout' : 'error' };
  } finally {
    clearTimeout(timer);
  }
}

/** The full report. `healthy` is false when the database cannot be reached (the route then answers 503). */
export async function buildDeepHealth({ connection = mongoose.connection, now = new Date(), timeoutMs = PING_TIMEOUT_MS } = {}) {
  const database = await pingDatabase(connection, timeoutMs);
  const healthy = database.status === 'up';
  return {
    healthy,
    body: {
      status: healthy ? 'ok' : 'degraded',
      version,
      // Render sets RENDER_GIT_COMMIT on every deploy; seven characters name the commit without anything else.
      commit: process.env.RENDER_GIT_COMMIT ? process.env.RENDER_GIT_COMMIT.slice(0, 7) : null,
      // A small number here means the service just (re)started: a cold start on the free plan, or a crash.
      uptimeSeconds: Math.round(process.uptime()),
      startedAt: startedAt.toISOString(),
      timestamp: now.toISOString(),
      paypalMode: config.paypal.environment === 'sandbox' ? 'sandbox' : 'live',
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      database,
    },
  };
}

let cached = null; // { at, promise }

/** buildDeepHealth(), but one report is shared by all callers within CACHE_MS. */
export function deepHealth(options) {
  const nowMs = Date.now();
  if (!options && cached && nowMs - cached.at < CACHE_MS) return cached.promise;
  const promise = buildDeepHealth(options);
  if (!options) cached = { at: nowMs, promise };
  return promise;
}

export function resetHealthCache() {
  cached = null;
}
