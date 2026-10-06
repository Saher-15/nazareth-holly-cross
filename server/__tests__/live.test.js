import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Live broadcasting (docs/LIVE.md): the Cloudflare Stream client against a fake fetch, the dashboard routes
// (/admin/live, start, stop) and the public status against a fake Cloudflare client. Nothing here touches the network.
// What matters most: the WHIP publish address (it holds the input's broadcast secret) is given once, to the admin who
// started the session, and appears nowhere else: not in the database, not in another answer, not in the audit log,
// not in the server log.

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
const { fakeStreamClient } = await import('../test-harness/fake-cloudflare.js');

const { http, close } = startClient(createApp());
afterAll(close);

let owner;
let owner2;
let editor;
let editor2;
let viewer;
beforeAll(async () => {
  owner = await signedIn(signSessionToken, { username: 'live-owner', role: 'owner' });
  owner2 = await signedIn(signSessionToken, { username: 'live-owner-2', role: 'owner' });
  editor = await signedIn(signSessionToken, { username: 'live-editor', role: 'editor' });
  editor2 = await signedIn(signSessionToken, { username: 'live-editor-2', role: 'editor' });
  viewer = await signedIn(signSessionToken, { username: 'live-viewer', role: 'viewer' });
});

let cf;
let logs;
beforeEach(() => {
  fakes.LiveSession.reset();
  fakes.AuditLog.reset();
  live.resetLiveStatusCache();
  cf = fakeStreamClient();
  stream.setStreamClient(cf);
  logs = [];
  for (const level of ['log', 'info', 'warn', 'error']) vi.spyOn(console, level).mockImplementation((...args) => logs.push(args.map(String).join(' ')));
});
afterEach(() => {
  vi.restoreAllMocks();
  stream.setStreamClient(null);
});

const call = (method, path, who = editor, body) => {
  const req = http[method](path).set('X-Forwarded-For', freshIp());
  if (who) req.set(who.auth);
  return body === undefined ? req : req.send(body);
};
const audits = (action) => fakes.AuditLog.docs.filter((d) => !action || d.action === action);
const start = (who = editor, title = 'Evening prayer at the Basilica') => call('post', '/admin/live/start', who, { title });
const status = () => http.get('/live/status').set('X-Forwarded-For', freshIp());
const HOURS = 3600_000;

/** Everything the server kept or said, as one text: the database, the audit log, the log lines. */
const everythingStored = () => JSON.stringify([fakes.LiveSession.docs, fakes.AuditLog.docs, logs]);

// ------------------------------------------------------------------ the Cloudflare client

describe('Cloudflare Stream client (services/cloudflareStream.js)', () => {
  const ACCOUNT = '023e105f4ecef8ad9ca31a8372d0c353';
  const TOKEN = 'cf-token-that-must-never-leak-0123456789';
  const UID = 'f256e6ea9341d51eea64c9454659e576';
  const WHIP = `https://customer-abc123.cloudflarestream.com/${'b'.repeat(64)}/webRTC/publish`;
  const WHEP = `https://customer-abc123.cloudflarestream.com/${UID}/webRTC/play`;
  const ok = (result) => new Response(JSON.stringify({ success: true, errors: [], messages: [], result }), { status: 200, headers: { 'content-type': 'application/json' } });
  const client = (fetchImpl) => stream.createCloudflareStreamClient({ accountId: ACCOUNT, apiToken: TOKEN, fetchImpl });

  it('creates a WebRTC live input with recording off, with the token only in the Authorization header', async () => {
    const fetchImpl = vi.fn(async () => ok({ uid: UID, webRTC: { url: WHIP }, webRTCPlayback: { url: WHEP }, rtmps: { url: 'rtmps://live.cloudflare.com:443/live/', streamKey: 'k' } }));
    const input = await client(fetchImpl).createLiveInput({ name: 'Test' });
    expect(input).toEqual({ uid: UID, whipUrl: WHIP, whepUrl: WHEP });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream/live_inputs`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.redirect).toBe('error');
    expect(JSON.parse(init.body)).toEqual({ meta: { name: 'Test' }, recording: { mode: 'off' }, enabled: true });
    expect(init.body).not.toContain(TOKEN);
  });

  it('deletes an input; one that is already gone counts as deleted', async () => {
    const fetchImpl = vi.fn(async () => ok(''));
    await expect(client(fetchImpl).deleteLiveInput(UID)).resolves.toEqual({ deleted: true });
    expect(fetchImpl.mock.calls[0][0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream/live_inputs/${UID}`);
    expect(fetchImpl.mock.calls[0][1].method).toBe('DELETE');
    const gone = vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10003, message: 'Not found' }] }), { status: 404 }));
    await expect(client(gone).deleteLiveInput(UID)).resolves.toEqual({ deleted: true, missing: true });
    await expect(client(fetchImpl).deleteLiveInput('../../accounts')).rejects.toThrow('Invalid live input id');
  });

  it('turns every failure into a StreamError without the token or an address Cloudflare returned', async () => {
    const cases = [
      vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }), { status: 403 })),
      vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10001, message: 'bad' }] }), { status: 200 })),
      vi.fn(async () => new Response('<html>gateway</html>', { status: 502 })),
      vi.fn(async () => { throw new TypeError('fetch failed'); }),
      vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }),
      // Cloudflare answered, but not with what we can use
      vi.fn(async () => ok({ uid: 'not-a-uid', webRTC: { url: WHIP }, webRTCPlayback: { url: WHEP } })),
      vi.fn(async () => ok({ uid: UID, webRTC: { url: 'https://evil.example.com/x/webRTC/publish' }, webRTCPlayback: { url: WHEP } })),
      vi.fn(async () => ok({ uid: UID, webRTC: { url: WHIP }, webRTCPlayback: { url: `http://customer-abc123.cloudflarestream.com/${UID}/webRTC/play` } })),
      vi.fn(async () => ok({ uid: UID })),
    ];
    for (const fetchImpl of cases) {
      const error = await client(fetchImpl).createLiveInput().catch((e) => e);
      expect(error).toBeInstanceOf(stream.StreamError);
      expect(error.message).not.toContain(TOKEN);
      expect(error.message).not.toContain('b'.repeat(64));
      expect(error.message).not.toContain('evil.example.com');
    }
    const auth = await client(cases[0]).createLiveInput().catch((e) => e);
    expect(auth.status).toBe(403);
    expect(auth.message).toBe('Cloudflare Stream POST /live_inputs failed (403): 10000 Authentication error');
  });

  it('accepts only https customer Stream addresses of the right kind', () => {
    expect(stream.checkStreamUrl(WHIP, 'publish')).toBe(WHIP);
    expect(stream.checkStreamUrl(WHEP, 'play')).toBe(WHEP);
    for (const bad of [
      WHEP, // a play address where a publish one is expected
      'https://customer-abc123.cloudflarestream.com.evil.com/x/webRTC/publish',
      'https://abc.cloudflarestream.com/x/webRTC/publish',
      'https://customer-abc123.cloudflarestream.com:8443/x/webRTC/publish',
      'https://user:pw@customer-abc123.cloudflarestream.com/x/webRTC/publish',
      'https://customer-abc123.cloudflarestream.com/x/webRTC/publish?redirect=1',
      'https://customer-abc123.cloudflarestream.com/a%2F..%2Fb/webRTC/publish',
      'javascript:alert(1)',
      null,
    ]) expect(() => stream.checkStreamUrl(bad, 'publish'), String(bad)).toThrow(stream.StreamError);
  });

  it('derives the Stream player page from the WHEP address and the input id', () => {
    expect(stream.playerUrl(WHEP, UID)).toBe(`https://customer-abc123.cloudflarestream.com/${UID}/iframe`);
    expect(stream.playerUrl('https://evil.example.com/x/webRTC/play', UID)).toBeNull();
    expect(stream.playerUrl(WHEP, 'nope')).toBeNull();
    expect(stream.playerUrl('', UID)).toBeNull();
  });

  it('is "not configured" without CF_ACCOUNT_ID and CF_STREAM_API_TOKEN', () => {
    stream.setStreamClient(null);
    expect(stream.getStreamClient()).toBeNull();
    expect(stream.streamConfigured()).toBe(false);
    expect(() => stream.createCloudflareStreamClient({ accountId: ACCOUNT, apiToken: '' })).toThrow();
  });
});

// ------------------------------------------------------------------ not configured

describe('when Cloudflare is not configured', () => {
  beforeEach(() => stream.setStreamClient(null));

  it('the dashboard says so, start answers 503 with the reason, the public status says "not live"', async () => {
    const state = await call('get', '/admin/live');
    expect(state.status).toBe(200);
    expect(state.body).toEqual({ configured: false, maxMinutes: 360, current: null, history: [] });
    const res = await start();
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/);
    expect(fakes.LiveSession.docs).toHaveLength(0);
    expect((await status()).body).toEqual({ live: false });
  });
});

// ------------------------------------------------------------------ start

describe('POST /admin/live/start', () => {
  it('creates the input, saves the session, and gives the WHIP address to the admin who started it', async () => {
    const res = await start();
    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const [input] = [...cf.inputs.entries()];
    expect(res.body.whipUrl).toBe(input[1].whipUrl);
    expect(res.body.session).toMatchObject({
      title: 'Evening prayer at the Basilica', status: 'live', inputUid: input[0], whepUrl: input[1].whepUrl,
      playbackUrl: `https://customer-fake0test.cloudflarestream.com/${input[0]}/iframe`, endedAt: null, endReason: null,
      startedBy: { id: editor.admin._id, name: 'live-editor' }, endedBy: null, inputDeleted: false,
    });
    expect(Object.keys(res.body.session)).not.toContain('whipUrl');
    expect(audits('live.start')).toHaveLength(1);
    expect(audits('live.start')[0]).toMatchObject({ actorName: 'live-editor', target: { type: 'live', id: res.body.session._id }, meta: { title: 'Evening prayer at the Basilica', inputUid: input[0] } });
  });

  it('the WHIP address is nowhere else: database, other answers, audit log, server log', async () => {
    const res = await start();
    const secret = new URL(res.body.whipUrl).pathname.split('/')[1];
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
    const answers = [await call('get', '/admin/live'), await call('get', '/admin/live', owner), await status(), await call('post', '/admin/live/stop', editor, {})];
    for (const a of answers) expect(JSON.stringify(a.body)).not.toContain(secret);
    expect(everythingStored()).not.toContain(secret);
    expect(everythingStored()).not.toContain('webRTC/publish');
  });

  it('only one broadcast at a time: 409 with the current one, and no second Cloudflare input', async () => {
    const first = await start(editor);
    const second = await start(owner, 'Another');
    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ error: 'A broadcast is already live', current: { _id: first.body.session._id, startedBy: { name: 'live-editor' } } });
    expect(JSON.stringify(second.body)).not.toContain('publish');
    expect(cf.calls.filter((c) => c.op === 'create')).toHaveLength(1);
  });

  it('two starts at the same moment: the database index lets one win, the other input is deleted again', async () => {
    const [a, b] = await Promise.all([start(editor, 'One'), start(editor2, 'Two')]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(fakes.LiveSession.docs.filter((d) => d.status === 'live')).toHaveLength(1);
    expect(cf.inputs.size).toBe(1); // the loser's input was removed
  });

  it('a Cloudflare failure answers 502, saves nothing, is audited and logged without secrets', async () => {
    cf.fail.create = true;
    const res = await start();
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Cloudflare Stream could not prepare the broadcast/);
    expect(fakes.LiveSession.docs).toHaveLength(0);
    expect(audits('live.start_failed')).toHaveLength(1);
    expect(logs.join('\n')).toMatch(/\[live\] start refused by Cloudflare/);
  });

  it('validates the body: a title of 1 to 120 characters, nothing else', async () => {
    for (const body of [{}, { title: '' }, { title: '   ' }, { title: 'x'.repeat(121) }, { title: ['a'] }, { title: { $ne: null } }, { title: 'ok', force: true }, { title: 'a\nb' }]) {
      const res = await call('post', '/admin/live/start', editor, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(cf.calls).toHaveLength(0);
    expect((await start(editor, 'x'.repeat(120))).status).toBe(201);
  });

  it('stores text the way every other route does (HTML-escaped by the sanitizer)', async () => {
    const res = await start(editor, 'Mass & vespers <script>x</script>');
    expect(res.status).toBe(201);
    expect(res.body.session.title).not.toContain('<script>');
    expect((await status()).body.title).toBe(res.body.session.title);
  });
});

// ------------------------------------------------------------------ stop

describe('POST /admin/live/stop', () => {
  it('the admin who started it ends it; the input is deleted; audited with the duration', async () => {
    const started = await start();
    const res = await call('post', '/admin/live/stop', editor, { sessionId: started.body.session._id });
    expect(res.status).toBe(200);
    expect(res.body.stopped).toBe(true);
    expect(res.body.session).toMatchObject({ status: 'ended', endReason: 'stopped', endedBy: { name: 'live-editor' }, inputDeleted: true });
    expect(res.body.session.endedAt).toBeTruthy();
    expect(cf.inputs.size).toBe(0);
    expect(audits('live.stop')[0]).toMatchObject({ actorName: 'live-editor', meta: { reason: 'stopped', minutes: 0, inputDeleted: true } });
    expect((await status()).body).toEqual({ live: false });
  });

  it('is safe to repeat and never ends a NEWER broadcast (a late stop from a closed tab)', async () => {
    const first = await start();
    await call('post', '/admin/live/stop', editor, {});
    const again = await call('post', '/admin/live/stop', editor, {});
    expect(again.body).toEqual({ stopped: false, session: null });
    const second = await start();
    const late = await call('post', '/admin/live/stop', editor, { sessionId: first.body.session._id });
    expect(late.body).toEqual({ stopped: false, session: null });
    expect(fakes.LiveSession.byId(second.body.session._id).status).toBe('live');
  });

  it('another editor may not end it; an owner must confirm (force) and is recorded', async () => {
    await start(editor);
    const other = await call('post', '/admin/live/stop', editor2, {});
    expect(other.status).toBe(403);
    const unconfirmed = await call('post', '/admin/live/stop', owner, {});
    expect(unconfirmed.status).toBe(409);
    expect(unconfirmed.body.current.startedBy.name).toBe('live-editor');
    const forced = await call('post', '/admin/live/stop', owner, { force: true });
    expect(forced.status).toBe(200);
    expect(forced.body.session).toMatchObject({ endReason: 'forced', endedBy: { name: 'live-owner' } });
    expect(audits('live.stop')[0].meta.reason).toBe('forced');
  });

  it('an owner ends their own broadcast without confirming, and another owner\'s only with force', async () => {
    await start(owner);
    expect((await call('post', '/admin/live/stop', owner2, {})).status).toBe(409);
    expect((await call('post', '/admin/live/stop', owner, {})).body.stopped).toBe(true);
  });

  it('when Cloudflare cannot delete the input the session still ends, and the log says which input (no address)', async () => {
    const started = await start();
    cf.fail.delete = true;
    const res = await call('post', '/admin/live/stop', editor, {});
    expect(res.body.session).toMatchObject({ status: 'ended', inputDeleted: false });
    expect(logs.join('\n')).toContain(`could not delete the Cloudflare live input ${started.body.session.inputUid}`);
    expect(everythingStored()).not.toContain(new URL(started.body.whipUrl).pathname.split('/')[1]);
  });

  it('validates the body', async () => {
    for (const body of [{ sessionId: 'nope' }, { sessionId: 'a'.repeat(25) }, { force: 'yes' }, { other: 1 }, { sessionId: { $gt: '' } }]) {
      expect((await call('post', '/admin/live/stop', editor, body)).status, JSON.stringify(body)).toBe(400);
    }
  });
});

// ------------------------------------------------------------------ automatic end, roles, history

describe('the automatic end after six hours', () => {
  it('a forgotten broadcast ends on the next status read, deletes its input and is audited as the system', async () => {
    const started = await start();
    fakes.LiveSession.byId(started.body.session._id).startedAt = new Date(Date.now() - 6 * HOURS - 60_000);
    live.resetLiveStatusCache();
    expect((await status()).body).toEqual({ live: false });
    expect(fakes.LiveSession.byId(started.body.session._id)).toMatchObject({ status: 'ended', endReason: 'auto', inputDeleted: true });
    expect(audits('live.auto_end')[0]).toMatchObject({ actorName: 'system', meta: { reason: 'auto', minutes: 361 } });
    expect(cf.inputs.size).toBe(0);
  });

  it('a younger one is left alone; endStaleSessions (the timer) ends only the old ones', async () => {
    const started = await start();
    fakes.LiveSession.byId(started.body.session._id).startedAt = new Date(Date.now() - 5 * HOURS);
    expect(await live.endStaleSessions()).toBe(0);
    expect(await live.endStaleSessions({ now: Date.now() + 2 * HOURS })).toBe(1);
  });

  it('a new start is possible right after a stale one ended by itself', async () => {
    const started = await start();
    fakes.LiveSession.byId(started.body.session._id).startedAt = new Date(Date.now() - 7 * HOURS);
    expect((await start(editor2, 'Next')).status).toBe(201);
  });
});

describe('GET /admin/live', () => {
  it('the current session and the ten most recent, newest first; no WHIP address', async () => {
    for (let i = 0; i < 12; i += 1) {
      await start(editor, `Broadcast ${i}`);
      await call('post', '/admin/live/stop', editor, {});
    }
    await start(editor, 'Now');
    const res = await call('get', '/admin/live', owner);
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(res.body.current.title).toBe('Now');
    expect(res.body.history).toHaveLength(10);
    expect(res.body.history.map((s) => s.title).slice(0, 2)).toEqual(['Now', 'Broadcast 11']);
    expect(JSON.stringify(res.body)).not.toContain('publish');
  });
});

describe('roles', () => {
  it('a viewer gets 403 on every live route, no token gets 401, and nothing happens', async () => {
    for (const [method, path, body] of [['get', '/admin/live'], ['post', '/admin/live/start', { title: 'x' }], ['post', '/admin/live/stop', {}]]) {
      expect((await call(method, path, viewer, body)).status, `${method} ${path}`).toBe(403);
      expect((await call(method, path, null, body)).status, `${method} ${path}`).toBe(401);
    }
    expect(cf.calls).toHaveLength(0);
    expect(audits()).toHaveLength(0);
  });
});

// ------------------------------------------------------------------ the public status

describe('GET /live/status', () => {
  it('says live with the title, the start and the player address, and nothing else', async () => {
    const started = await start();
    const res = await status();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      live: true, title: 'Evening prayer at the Basilica', startedAt: started.body.session.startedAt,
      playbackUrl: `https://customer-fake0test.cloudflarestream.com/${started.body.session.inputUid}/iframe`,
    });
    expect(res.headers['cache-control']).toBe('public, max-age=5, s-maxage=5, stale-while-revalidate=10, stale-if-error=30');
  });

  it('is answered from memory for five seconds (the database is asked at most once per window)', async () => {
    await start();
    live.resetLiveStatusCache();
    fakes.LiveSession.calls.length = 0;
    for (let i = 0; i < 5; i += 1) await status();
    expect(fakes.LiveSession.calls.filter((c) => c.op === 'findOne')).toHaveLength(1);
  });

  it('has its own, larger rate limit (not the 200-per-15-minutes one), and an error is not cached', async () => {
    const res = await status();
    expect(res.headers.ratelimit).toMatch(/limit=3000/);
    const original = fakes.LiveSession.findOne;
    fakes.LiveSession.findOne = () => { throw new Error('database down'); };
    live.resetLiveStatusCache();
    const failed = await status();
    fakes.LiveSession.findOne = original;
    expect(failed.status).toBe(500);
    expect(failed.headers['cache-control']).toBe('no-store');
  });

  it('the old room routes are gone', async () => {
    expect((await http.get('/live/room_id').set('X-Forwarded-For', freshIp())).status).toBe(404);
    expect((await http.post('/live/create_room').set('X-Forwarded-For', freshIp()).send({ roomID: 'abc' })).status).toBe(404);
    expect((await http.post('/live/close_room').set('X-Forwarded-For', freshIp()).send({})).status).toBe(404);
  });
});

describe('database queries', () => {
  it('every filter survives sanitizeFilter and casts against the real LiveSession schema', async () => {
    fakes.LiveSession.calls.length = 0;
    const started = await start();
    fakes.LiveSession.byId(started.body.session._id).startedAt = new Date(Date.now() - 7 * HOURS);
    live.resetLiveStatusCache();
    await status();
    await call('get', '/admin/live');
    await call('post', '/admin/live/stop', editor, { sessionId: started.body.session._id });
    const filters = allFilters().filter((f) => f.name === 'LiveSession');
    expect(filters.length).toBeGreaterThan(3);
    for (const { op, filter } of filters) {
      expect(sanitizeChanges(filter), `${op} ${JSON.stringify(filter)}`).toBeNull();
      expect(await castProblem('LiveSession', filter), `${op} ${JSON.stringify(filter)}`).toBeNull();
    }
  });
});
