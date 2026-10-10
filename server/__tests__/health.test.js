import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

// GET /health/deep: the monitor's view of the API (database ping with a deadline, uptime, version) and nothing secret.

const { createApp } = await import('../app.js');
const { buildDeepHealth, pingDatabase, resetHealthCache, CACHE_MS } = await import('../services/health.js');
const app = createApp();

/** A stand-in for mongoose.connection: only what the ping touches. */
const connection = (ping, readyState = 1) => ({ readyState, db: readyState === 1 ? { admin: () => ({ ping }) } : undefined });

/** Makes the shared mongoose connection look connected, with a ping that is the given function. */
function connectedWith(ping) {
  vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
  mongoose.connection.db = { admin: () => ({ ping }) };
}

beforeEach(() => resetHealthCache());
afterEach(() => {
  vi.restoreAllMocks();
  delete mongoose.connection.db;
});

describe('pingDatabase', () => {
  it('is up and says how long the ping took', async () => {
    const result = await pingDatabase(connection(async () => ({ ok: 1 })));
    expect(result).toMatchObject({ status: 'up', state: 'connected' });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('is down, without asking the database, while disconnected or still connecting', async () => {
    const ping = vi.fn();
    expect(await pingDatabase(connection(ping, 0))).toEqual({ status: 'down', state: 'disconnected' });
    expect(await pingDatabase(connection(ping, 2))).toEqual({ status: 'down', state: 'connecting' });
    expect(ping).not.toHaveBeenCalled();
  });

  it('gives up after the deadline instead of hanging the monitor', async () => {
    const hangs = () => new Promise(() => {});
    const started = Date.now();
    const result = await pingDatabase(connection(hangs), 40);
    expect(result).toEqual({ status: 'down', state: 'connected', reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('never repeats the driver error text (it can hold a host name or a user name)', async () => {
    const result = await pingDatabase(connection(async () => { throw new Error('connect ECONNREFUSED cluster0-shard-00-00.abcde.mongodb.net:27017 user=admin'); }));
    expect(result).toEqual({ status: 'down', state: 'connected', reason: 'error' });
    expect(JSON.stringify(result)).not.toMatch(/mongodb\.net|admin|ECONNREFUSED/);
  });
});

describe('buildDeepHealth', () => {
  it('reports ok with version, uptime and PayPal mode', async () => {
    const { healthy, body } = await buildDeepHealth({ connection: connection(async () => ({ ok: 1 })), now: new Date('2026-10-06T10:00:00Z') });
    expect(healthy).toBe(true);
    expect(body).toMatchObject({ status: 'ok', paypalMode: 'sandbox', timestamp: '2026-10-06T10:00:00.000Z', database: { status: 'up' } });
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof body.memoryMb).toBe('number');
  });

  it('reports the 7-character commit Railway gives it, preferred over a leftover Render one', async () => {
    const saved = { railway: process.env.RAILWAY_GIT_COMMIT_SHA, render: process.env.RENDER_GIT_COMMIT };
    process.env.RAILWAY_GIT_COMMIT_SHA = 'abcdef0123456789abcdef0123456789abcdef01';
    process.env.RENDER_GIT_COMMIT = '0123456789abcdef0123456789abcdef01234567';
    expect((await buildDeepHealth({ connection: connection(async () => ({})) })).body.commit).toBe('abcdef0');
    for (const [key, value] of [['RAILWAY_GIT_COMMIT_SHA', saved.railway], ['RENDER_GIT_COMMIT', saved.render]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  it('reports the 7-character commit Render gives it, and null without one', async () => {
    const saved = process.env.RENDER_GIT_COMMIT;
    process.env.RENDER_GIT_COMMIT = '0123456789abcdef0123456789abcdef01234567';
    expect((await buildDeepHealth({ connection: connection(async () => ({})) })).body.commit).toBe('0123456');
    delete process.env.RENDER_GIT_COMMIT;
    expect((await buildDeepHealth({ connection: connection(async () => ({})) })).body.commit).toBeNull();
    if (saved !== undefined) process.env.RENDER_GIT_COMMIT = saved;
  });

  it('is degraded when the database cannot be reached', async () => {
    const { healthy, body } = await buildDeepHealth({ connection: connection(null, 0) });
    expect(healthy).toBe(false);
    expect(body).toMatchObject({ status: 'degraded', database: { status: 'down' } });
  });
});

describe('GET /health/deep', () => {
  it('answers 503 (a monitor raises the alarm) when there is no database, as in tests', async () => {
    const res = await request(app).get('/health/deep');
    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ status: 'degraded', database: { status: 'down', state: 'disconnected' } });
  });

  it('answers 200 once the database answers the ping', async () => {
    const ping = vi.fn(async () => ({ ok: 1 }));
    connectedWith(ping);
    const res = await request(app).get('/health/deep');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: { status: 'up' } });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('shares one database ping between callers within the cache window', async () => {
    const ping = vi.fn(async () => ({ ok: 1 }));
    connectedWith(ping);
    await Promise.all([1, 2, 3, 4, 5].map(() => request(app).get('/health/deep')));
    expect(ping).toHaveBeenCalledTimes(1);
    expect(CACHE_MS).toBeGreaterThanOrEqual(1000);
  });

  it('exposes no secret, connection string or environment value', async () => {
    const res = await request(app).get('/health/deep');
    const text = JSON.stringify(res.body);
    for (const secret of [process.env.JWT_SECRET, process.env.ADMIN_PASSWORD, process.env.CLIENT_SECRET, process.env.MAIL_APP_PASSWORD, process.env.DATABASEURL].filter((v) => v && v.length >= 8)) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(/mongodb|password|secret|token/i);
  });

  it('is not reachable with other methods', async () => {
    expect((await request(app).post('/health/deep')).status).toBe(404);
  });
});

describe('the health checks have a counter of their own', () => {
  it('a client that used up the general allowance can still be health-checked', async () => {
    const ip = '10.9.0.1';
    // 200 requests to a general route from one address, then one more: the general limiter refuses it.
    for (let i = 0; i < 200; i += 1) await request(app).get('/nothing-here').set('X-Forwarded-For', ip);
    expect((await request(app).get('/nothing-here').set('X-Forwarded-For', ip)).status).toBe(429);
    expect((await request(app).get('/health').set('X-Forwarded-For', ip)).status).toBe(200);
    expect((await request(app).get('/health/deep').set('X-Forwarded-For', ip)).status).toBe(503); // answered, not limited
  });
});
