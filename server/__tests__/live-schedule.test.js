import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Scheduled broadcasts (docs/LIVE.md "Scheduled broadcasts"): Nazareth time <-> UTC (including the two days a year
// the clocks change), the dashboard routes (/admin/live/schedule), starting a live broadcast from a scheduled one,
// and the website's list (/live/schedule). Nothing here touches the network (the Cloudflare client is a fake).

vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));

const { fakes } = await import('./helpers/fakes.js');
const { allFilters, castProblem, freshIp, sanitizeChanges, signedIn, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { signSessionToken } = await import('../services/adminSessions.js');
const stream = await import('../services/cloudflareStream.js');
const live = await import('../services/live.js');
const schedule = await import('../services/liveSchedule.js');
const { fakeStreamClient } = await import('../test-harness/fake-cloudflare.js');

const { http, close } = startClient(createApp());
afterAll(close);

let owner;
let editor;
let viewer;
beforeAll(async () => {
  owner = await signedIn(signSessionToken, { username: 'plan-owner', role: 'owner' });
  editor = await signedIn(signSessionToken, { username: 'plan-editor', role: 'editor' });
  viewer = await signedIn(signSessionToken, { username: 'plan-viewer', role: 'viewer' });
});

let cf;
beforeEach(() => {
  fakes.LiveSession.reset();
  fakes.ScheduledBroadcast.reset();
  fakes.AuditLog.reset();
  live.resetLiveStatusCache();
  schedule.resetScheduleCache();
  cf = fakeStreamClient();
  stream.setStreamClient(cf);
});
afterEach(() => {
  vi.restoreAllMocks();
  stream.setStreamClient(null);
});

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const call = (method, path, who = editor, body) => {
  const req = http[method](path).set('X-Forwarded-For', freshIp());
  if (who) req.set(who.auth);
  return body === undefined ? req : req.send(body);
};
const audits = (action) => fakes.AuditLog.docs.filter((d) => !action || d.action === action);
const publicList = () => http.get('/live/schedule').set('X-Forwarded-For', freshIp());
/** "YYYY-MM-DDTHH:MM" in Nazareth for an instant `ms` from now, at a whole minute. */
const localIn = (ms) => schedule.utcToNazarethLocal(Math.floor((Date.now() + ms) / 60_000) * 60_000);
const plan = (body, who = editor) => call('post', '/admin/live/schedule', who, body);

/** The wall-clock time of an instant in Nazareth, by Intl (independent of the code under test). */
const nazarethWall = (iso) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

/** Scheduled broadcasts written straight into the fake database (any time, any status). */
const seed = (docs) => fakes.ScheduledBroadcast.seed(docs.map((d) => ({
  description: '', published: true, status: 'scheduled', liveSession: null, createdBy: { id: null, name: 'seed' }, updatedBy: { id: null, name: 'seed' }, ...d,
})));

// ------------------------------------------------------------------ Nazareth time

describe('Nazareth time <-> UTC (services/liveSchedule.js)', () => {
  const utc = (local) => schedule.nazarethToUtc(local)?.toISOString() ?? null;

  it('winter is UTC+2, summer UTC+3', () => {
    expect(utc('2026-12-24T23:30')).toBe('2026-12-24T21:30:00.000Z');
    expect(utc('2027-01-01T00:15')).toBe('2026-12-31T22:15:00.000Z');
    expect(utc('2026-07-01T19:30')).toBe('2026-07-01T16:30:00.000Z');
  });

  it('spring (27 March 2026, 02:00 -> 03:00): a time in the skipped hour moves forward by the gap', () => {
    expect(utc('2026-03-27T01:59')).toBe('2026-03-26T23:59:00.000Z');
    expect(utc('2026-03-27T02:00')).toBe('2026-03-27T00:00:00.000Z'); // shown as 03:00
    expect(utc('2026-03-27T02:30')).toBe('2026-03-27T00:30:00.000Z'); // shown as 03:30
    expect(utc('2026-03-27T03:00')).toBe('2026-03-27T00:00:00.000Z');
    expect(schedule.utcToNazarethLocal(utc('2026-03-27T02:30'))).toBe('2026-03-27T03:30');
    expect(utc('2027-03-26T02:15')).toBe('2027-03-26T00:15:00.000Z');
  });

  it('autumn (25 October 2026, 02:00 -> 01:00): a time that happens twice is the first one, summer time', () => {
    expect(utc('2026-10-25T00:30')).toBe('2026-10-24T21:30:00.000Z');
    expect(utc('2026-10-25T01:30')).toBe('2026-10-24T22:30:00.000Z');
    expect(utc('2026-10-25T02:30')).toBe('2026-10-25T00:30:00.000Z');
    expect(utc('2027-10-31T01:00')).toBe('2027-10-30T22:00:00.000Z');
  });

  it('agrees with Intl both ways for every hour of the two changeover days and a whole year of evenings', () => {
    for (const day of ['2026-03-26', '2026-03-27', '2026-10-24', '2026-10-25']) {
      for (let h = 0; h < 24; h += 1) {
        const local = `${day}T${String(h).padStart(2, '0')}:20`;
        const shown = nazarethWall(utc(local));
        // the same wall time, or (only in the skipped spring hour) one hour later
        expect([local, `${day}T${String(h + 1).padStart(2, '0')}:20`], local).toContain(shown);
      }
    }
    for (let d = 0; d < 366; d += 1) {
      const date = new Date(Date.UTC(2026, 0, 1) + d * DAY).toISOString().slice(0, 10);
      expect(nazarethWall(utc(`${date}T19:30`))).toBe(`${date}T19:30`);
      expect(schedule.utcToNazarethLocal(utc(`${date}T19:30`))).toBe(`${date}T19:30`);
    }
  });

  it('refuses what is not a real date and time', () => {
    for (const bad of ['2026-02-30T10:00', '2026-13-01T10:00', '2026-10-20T24:00', '2026-10-20T10:60', '2026-10-20 10:00', '2026-10-20T10:00Z', '20-10-2026T10:00', '', null, { $gt: '' }]) {
      expect(utc(bad), String(bad)).toBeNull();
    }
    expect(schedule.utcToNazarethLocal('not a date')).toBeNull();
  });
});

// ------------------------------------------------------------------ the dashboard routes

describe('POST /admin/live/schedule', () => {
  it('stores the Nazareth time in UTC, a draft by default, audited', async () => {
    const local = localIn(3 * DAY);
    const res = await plan({ title: 'Sunday Mass from the Basilica', description: 'Line one\nLine two', startsAtLocal: local });
    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.item).toMatchObject({
      title: 'Sunday Mass from the Basilica', description: 'Line one\nLine two', startsAtLocal: local, timeZone: 'Asia/Jerusalem',
      published: false, status: 'scheduled', liveSession: null, createdBy: { id: editor.admin._id, name: 'plan-editor' },
    });
    expect(nazarethWall(res.body.item.startsAt)).toBe(local);
    const stored = fakes.ScheduledBroadcast.byId(res.body.item._id);
    expect(stored.startsAt).toBeInstanceOf(Date);
    expect(stored.startsAt.toISOString()).toBe(res.body.item.startsAt);
    expect(audits('live.schedule_create')[0]).toMatchObject({ actorName: 'plan-editor', meta: { title: 'Sunday Mass from the Basilica', startsAt: res.body.item.startsAt, published: false } });
  });

  it('validates: a title, a real time from five minutes ago to a year ahead, a description up to 500, nothing else', async () => {
    const ok = { title: 'Mass', startsAtLocal: localIn(DAY) };
    for (const body of [
      {}, { title: 'Mass' }, { startsAtLocal: localIn(DAY) }, { ...ok, title: '' }, { ...ok, title: 'x'.repeat(121) },
      { ...ok, description: 'y'.repeat(501) }, { ...ok, startsAtLocal: localIn(-HOUR) }, { ...ok, startsAtLocal: localIn(401 * DAY) },
      { ...ok, startsAtLocal: '2026-02-30T10:00' }, { ...ok, startsAtLocal: '2026-10-20T10:00:00' }, { ...ok, startsAtLocal: { $gt: '' } },
      { ...ok, startsAt: new Date().toISOString() }, { ...ok, status: 'live' }, { ...ok, published: 'yes' }, { ...ok, title: 'a\nb' },
    ]) {
      expect((await plan(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(fakes.ScheduledBroadcast.docs).toHaveLength(0);
    expect((await plan({ ...ok, description: 'y'.repeat(500), published: true })).status).toBe(201);
    expect((await plan({ ...ok, startsAtLocal: localIn(-2 * 60_000) })).status).toBe(201); // the minutes it takes to fill in the form
  });
});

describe('GET /admin/live/schedule', () => {
  it('soonest first: drafts, cancelled and the live one included; anything older than a week left out', async () => {
    const now = Date.now();
    seed([
      { title: 'Next week', startsAt: new Date(now + 7 * DAY) },
      { title: 'Tomorrow (draft)', startsAt: new Date(now + DAY), published: false },
      { title: 'Cancelled', startsAt: new Date(now + 2 * DAY), status: 'cancelled' },
      { title: 'Yesterday', startsAt: new Date(now - DAY), status: 'done' },
      { title: 'Long ago', startsAt: new Date(now - 30 * DAY), status: 'done' },
      { title: 'Live since long ago', startsAt: new Date(now - 10 * DAY), status: 'live' },
    ]);
    const res = await call('get', '/admin/live/schedule');
    expect(res.status).toBe(200);
    expect(res.body.timeZone).toBe('Asia/Jerusalem');
    expect(res.body.items.map((i) => i.title)).toEqual(['Live since long ago', 'Yesterday', 'Tomorrow (draft)', 'Cancelled', 'Next week']);
    expect(res.body.items[2].startsAtLocal).toBe(schedule.utcToNazarethLocal(now + DAY));
  });
});

describe('PATCH and DELETE /admin/live/schedule/:id', () => {
  it('edits the title, description, time and publication; cancels and restores; every change audited', async () => {
    const { body } = await plan({ title: 'Mass', startsAtLocal: localIn(DAY) });
    const id = body.item._id;
    const later = localIn(2 * DAY);
    const edited = await call('patch', `/admin/live/schedule/${id}`, owner, { title: 'Solemn Mass', description: 'With the choir', startsAtLocal: later, published: true });
    expect(edited.status).toBe(200);
    expect(edited.body.item).toMatchObject({ title: 'Solemn Mass', description: 'With the choir', startsAtLocal: later, published: true, status: 'scheduled' });
    expect(fakes.ScheduledBroadcast.byId(id).updatedBy).toMatchObject({ name: 'plan-owner' });
    expect((await call('patch', `/admin/live/schedule/${id}`, editor, { status: 'cancelled' })).body.item.status).toBe('cancelled');
    expect((await call('patch', `/admin/live/schedule/${id}`, editor, { status: 'scheduled' })).body.item.status).toBe('scheduled');
    expect(audits('live.schedule_update').map((a) => a.meta)).toEqual([
      { title: 'Solemn Mass', published: true, description: true, startsAt: edited.body.item.startsAt },
      { status: 'cancelled' },
      { status: 'scheduled' },
    ]);
  });

  it('validates the body; a live or finished broadcast keeps its time and status (its title may change)', async () => {
    const [livePlan] = seed([{ title: 'On air', startsAt: new Date(Date.now() - HOUR), status: 'live' }]);
    for (const body of [{}, { status: 'live' }, { status: 'done' }, { startsAtLocal: 'soon' }, { liveSession: '64b000000000000000000001' }, { title: '' }]) {
      expect((await call('patch', `/admin/live/schedule/${livePlan._id}`, editor, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await call('patch', `/admin/live/schedule/${livePlan._id}`, editor, { status: 'cancelled' })).status).toBe(409);
    expect((await call('patch', `/admin/live/schedule/${livePlan._id}`, editor, { startsAtLocal: localIn(DAY) })).status).toBe(409);
    expect((await call('patch', `/admin/live/schedule/${livePlan._id}`, editor, { title: 'On air now' })).body.item).toMatchObject({ title: 'On air now', status: 'live' });
    const { body } = await plan({ title: 'Mass', startsAtLocal: localIn(DAY) });
    expect((await call('patch', `/admin/live/schedule/${body.item._id}`, editor, { startsAtLocal: localIn(-2 * HOUR) })).status).toBe(400);
    expect((await call('patch', '/admin/live/schedule/64b000000000000000000099', editor, { title: 'x' })).status).toBe(404);
    expect((await call('patch', '/admin/live/schedule/nope', editor, { title: 'x' })).status).toBe(404);
  });

  it('deletes (audited), but never a broadcast that is live', async () => {
    const { body } = await plan({ title: 'Mass', startsAtLocal: localIn(DAY) });
    const res = await call('delete', `/admin/live/schedule/${body.item._id}`, editor);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(fakes.ScheduledBroadcast.docs).toHaveLength(0);
    expect(audits('live.schedule_delete')[0].meta).toMatchObject({ title: 'Mass', status: 'scheduled' });
    expect((await call('delete', `/admin/live/schedule/${body.item._id}`, editor)).status).toBe(404);
    const [onAir] = seed([{ title: 'On air', startsAt: new Date(), status: 'live' }]);
    expect((await call('delete', `/admin/live/schedule/${onAir._id}`, owner)).status).toBe(409);
  });
});

// ------------------------------------------------------------------ the website's list

describe('GET /live/schedule (public)', () => {
  it('only published, upcoming (or started less than two hours ago, or live), soonest first, nothing private', async () => {
    const now = Date.now();
    const [soon, , live1, , , , later] = seed([
      { title: 'Soon', description: 'From the grotto', startsAt: new Date(now + HOUR) },
      { title: 'Draft', startsAt: new Date(now + 2 * HOUR), published: false },
      { title: 'Started an hour ago', startsAt: new Date(now - HOUR), status: 'live' },
      { title: 'Missed', startsAt: new Date(now - 3 * HOUR) }, // past the two-hour grace: drops off by itself
      { title: 'Cancelled', startsAt: new Date(now + 3 * HOUR), status: 'cancelled' },
      { title: 'Done', startsAt: new Date(now - 30 * 60_000), status: 'done' },
      { title: 'Next month', startsAt: new Date(now + 30 * DAY) },
    ]);
    const res = await publicList();
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30, s-maxage=30, stale-while-revalidate=60, stale-if-error=600');
    expect(res.headers.ratelimit).toMatch(/limit=1000/);
    expect(res.body).toEqual({
      timeZone: 'Asia/Jerusalem',
      items: [live1, soon, later].map((d) => ({ id: String(d._id), title: d.title, description: d.description, startsAt: d.startsAt.toISOString(), status: d.status })),
    });
  });

  it('at most ten; answered from memory; follows the dashboard\'s changes at once', async () => {
    const now = Date.now();
    seed(Array.from({ length: 12 }, (_, i) => ({ title: `Broadcast ${i}`, startsAt: new Date(now + (i + 1) * DAY) })));
    expect((await publicList()).body.items.map((i) => i.title)).toEqual(Array.from({ length: 10 }, (_, i) => `Broadcast ${i}`));
    fakes.ScheduledBroadcast.calls.length = 0;
    for (let i = 0; i < 4; i += 1) await publicList();
    expect(fakes.ScheduledBroadcast.calls.filter((c) => c.op === 'find')).toHaveLength(0);
    const { body } = await plan({ title: 'Added now', startsAtLocal: localIn(HOUR), published: true });
    expect((await publicList()).body.items[0].title).toBe('Added now');
    await call('patch', `/admin/live/schedule/${body.item._id}`, editor, { published: false });
    expect((await publicList()).body.items[0].title).toBe('Broadcast 0');
  });
});

// ------------------------------------------------------------------ going live from a scheduled broadcast

describe('starting a live broadcast from a scheduled one', () => {
  it('the scheduled item becomes live (linked to the session), then done when the broadcast ends', async () => {
    const { body } = await plan({ title: 'Evening prayer', startsAtLocal: localIn(30 * 60_000), published: true });
    const id = body.item._id;
    const started = await call('post', '/admin/live/start', editor, { title: 'Evening prayer', scheduleId: id });
    expect(started.status).toBe(201);
    expect(fakes.ScheduledBroadcast.byId(id)).toMatchObject({ status: 'live', liveSession: started.body.session._id });
    expect(audits('live.start')[0].meta).toMatchObject({ scheduleId: id, scheduleLinked: true });
    expect((await publicList()).body.items).toEqual([expect.objectContaining({ id, status: 'live' })]);
    const status = await http.get('/live/status').set('X-Forwarded-For', freshIp());
    expect(status.body).toMatchObject({ live: true, id: started.body.session._id });

    await call('post', '/admin/live/stop', editor, { sessionId: started.body.session._id });
    expect(fakes.ScheduledBroadcast.byId(id).status).toBe('done');
    expect((await publicList()).body.items).toEqual([]);
  });

  it('a broadcast that ends by itself after six hours marks its scheduled item done too', async () => {
    const { body } = await plan({ title: 'Vigil', startsAtLocal: localIn(HOUR) });
    const started = await call('post', '/admin/live/start', editor, { title: 'Vigil', scheduleId: body.item._id });
    fakes.LiveSession.byId(started.body.session._id).startedAt = new Date(Date.now() - 7 * HOUR);
    expect(await live.endStaleSessions()).toBe(1);
    expect(fakes.ScheduledBroadcast.byId(body.item._id).status).toBe('done');
  });

  it('an unknown or not-waiting scheduled item is refused before Cloudflare is asked; without one nothing is linked', async () => {
    const [cancelled, done] = seed([
      { title: 'Cancelled', startsAt: new Date(Date.now() + HOUR), status: 'cancelled' },
      { title: 'Done', startsAt: new Date(Date.now() - HOUR), status: 'done' },
    ]);
    expect((await call('post', '/admin/live/start', editor, { title: 'x', scheduleId: '64b000000000000000000099' })).status).toBe(404);
    expect((await call('post', '/admin/live/start', editor, { title: 'x', scheduleId: String(cancelled._id) })).status).toBe(409);
    expect((await call('post', '/admin/live/start', editor, { title: 'x', scheduleId: String(done._id) })).status).toBe(409);
    expect((await call('post', '/admin/live/start', editor, { title: 'x', scheduleId: 'nope' })).status).toBe(400);
    expect(cf.calls).toHaveLength(0);
    const { body } = await plan({ title: 'Mass', startsAtLocal: localIn(HOUR) });
    const plain = await call('post', '/admin/live/start', editor, { title: 'Unplanned prayer' });
    expect(plain.status).toBe(201);
    expect(fakes.ScheduledBroadcast.byId(body.item._id)).toMatchObject({ status: 'scheduled', liveSession: null });
    expect(audits('live.start')[0].meta).not.toHaveProperty('scheduleId');
  });
});

// ------------------------------------------------------------------ roles and queries

describe('roles', () => {
  it('a viewer gets 403 and no token 401 on every schedule route, and nothing happens', async () => {
    const ID = '64b000000000000000000001';
    for (const [method, path, body] of [
      ['get', '/admin/live/schedule'], ['post', '/admin/live/schedule', { title: 'x', startsAtLocal: localIn(DAY) }],
      ['patch', `/admin/live/schedule/${ID}`, { title: 'x' }], ['delete', `/admin/live/schedule/${ID}`],
    ]) {
      expect((await call(method, path, viewer, body)).status, `${method} ${path}`).toBe(403);
      expect((await call(method, path, null, body)).status, `${method} ${path}`).toBe(401);
    }
    expect(fakes.ScheduledBroadcast.docs).toHaveLength(0);
    expect(audits()).toHaveLength(0);
  });
});

describe('database queries', () => {
  it('every ScheduledBroadcast filter survives sanitizeFilter and casts against the real schema', async () => {
    fakes.ScheduledBroadcast.calls.length = 0;
    const { body } = await plan({ title: 'Mass', startsAtLocal: localIn(HOUR), published: true });
    await call('get', '/admin/live/schedule');
    await publicList();
    await call('patch', `/admin/live/schedule/${body.item._id}`, editor, { title: 'Mass 2' });
    const started = await call('post', '/admin/live/start', editor, { title: 'Mass', scheduleId: body.item._id });
    await call('post', '/admin/live/stop', editor, { sessionId: started.body.session._id });
    const other = await plan({ title: 'Other', startsAtLocal: localIn(DAY) });
    await call('delete', `/admin/live/schedule/${other.body.item._id}`, editor);
    const filters = allFilters().filter((f) => f.name === 'ScheduledBroadcast');
    expect(filters.length).toBeGreaterThan(6);
    for (const { op, filter } of filters) {
      expect(sanitizeChanges(filter), `${op} ${JSON.stringify(filter)}`).toBeNull();
      expect(await castProblem('ScheduledBroadcast', filter), `${op} ${JSON.stringify(filter)}`).toBeNull();
    }
  });
});
