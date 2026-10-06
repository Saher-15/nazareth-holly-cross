import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Recordings of live broadcasts (docs/LIVE.md "Recordings"): the Cloudflare client's upload, video and storage calls
// against a fake fetch, and the dashboard routes (/admin/live/recordings) and the public list (/live/recordings)
// against a fake Cloudflare client. Nothing here touches the network.
// What matters most: the one-time upload address is given once, to the admin who asked, and appears nowhere else; a
// recording is published only when Cloudflare can play it; the website lists only published, ready ones; deleting
// removes the video at Cloudflare too; every change is audited.

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
const recordings = await import('../services/liveRecordings.js');
const { fakeStreamClient } = await import('../test-harness/fake-cloudflare.js');

const { http, close } = startClient(createApp());
afterAll(close);

let owner;
let editor;
let editor2;
let viewer;
beforeAll(async () => {
  owner = await signedIn(signSessionToken, { username: 'rec-owner', role: 'owner' });
  editor = await signedIn(signSessionToken, { username: 'rec-editor', role: 'editor' });
  editor2 = await signedIn(signSessionToken, { username: 'rec-editor-2', role: 'editor' });
  viewer = await signedIn(signSessionToken, { username: 'rec-viewer', role: 'viewer' });
});

let cf;
let logs;
beforeEach(() => {
  fakes.LiveSession.reset();
  fakes.LiveRecording.reset();
  fakes.ScheduledBroadcast.reset();
  fakes.AuditLog.reset();
  live.resetLiveStatusCache();
  recordings.resetRecordingsCache();
  recordings.resetStorageCache();
  cf = fakeStreamClient();
  stream.setStreamClient(cf);
  logs = [];
  for (const level of ['log', 'info', 'warn', 'error']) vi.spyOn(console, level).mockImplementation((...args) => logs.push(args.map(String).join(' ')));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  stream.setStreamClient(null);
});

const call = (method, path, who = editor, body) => {
  const req = http[method](path).set('X-Forwarded-For', freshIp());
  if (who) req.set(who.auth);
  return body === undefined ? req : req.send(body);
};
const audits = (action) => fakes.AuditLog.docs.filter((d) => !action || d.action === action);
const MB = 1024 * 1024;
const UPLOAD = { sizeBytes: 300 * MB, durationSeconds: 1800, mimeType: 'video/webm;codecs=vp9,opus' };

/** A broadcast started and ended through the API by `who`; returns the ended session. */
async function broadcast(who = editor, title = 'Evening prayer at the Basilica') {
  const started = await call('post', '/admin/live/start', who, { title });
  expect(started.status).toBe(201);
  await call('post', '/admin/live/stop', who, { sessionId: started.body.session._id });
  return started.body.session;
}
const create = (session, who = editor, extra = {}) => call('post', '/admin/live/recordings', who, { sessionId: session._id, ...UPLOAD, ...extra });
const list = (who = editor) => call('get', '/admin/live/recordings', who);
const publicList = () => http.get('/live/recordings').set('X-Forwarded-For', freshIp());

/** Everything the server kept or said, as one text: the database, the audit log, the log lines. */
const everythingStored = () => JSON.stringify([fakes.LiveSession.docs, fakes.LiveRecording.docs, fakes.AuditLog.docs, logs]);

/** A recording that went all the way: created, made ready by Cloudflare, uploaded (the API checks at once). */
async function readyRecording(who = editor, title) {
  const session = await broadcast(who, title);
  const created = await create(session, who);
  expect(created.status).toBe(201);
  cf.setVideoState(created.body.recording.cfVideoUid, 'ready', { durationSeconds: 1795 });
  const done = await call('post', `/admin/live/recordings/${created.body.recordingId}/uploaded`, who, {});
  expect(done.body.recording.status).toBe('ready');
  return { session, recording: done.body.recording };
}

// ------------------------------------------------------------------ the Cloudflare client

describe('Cloudflare Stream client: uploads, videos, storage (services/cloudflareStream.js)', () => {
  const ACCOUNT = '023e105f4ecef8ad9ca31a8372d0c353';
  const TOKEN = 'cf-token-that-must-never-leak-0123456789';
  const UID = 'dd5d531a12de0c724bd1275a3b2bc9c6';
  const LOCATION = `https://upload.videodelivery.net/tus/${UID}?tusv2=true`;
  const client = (fetchImpl) => stream.createCloudflareStreamClient({ accountId: ACCOUNT, apiToken: TOKEN, fetchImpl });
  const created = (headers = { location: LOCATION, 'stream-media-id': UID }) => new Response(null, { status: 201, headers });
  const ok = (result) => new Response(JSON.stringify({ success: true, errors: [], messages: [], result }), { status: 200, headers: { 'content-type': 'application/json' } });
  const decodeMetadata = (value) => Object.fromEntries(value.split(',').map((pair) => {
    const [key, b64] = pair.split(' ');
    return [key, Buffer.from(b64, 'base64').toString('utf8')];
  }));

  it('asks for a one-time tus upload (direct_user=true) with the size, a name, a maximum length and an expiry; the token only in Authorization', async () => {
    const fetchImpl = vi.fn(async () => created());
    const expiresAt = new Date('2026-10-07T12:00:00.000Z');
    const upload = await client(fetchImpl).createUpload({ sizeBytes: 300 * MB, name: 'Evening prayer', maxDurationSeconds: 2100, expiresAt });
    expect(upload).toEqual({ uid: UID, uploadUrl: LOCATION });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream?direct_user=true`);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(init.body).toBeUndefined();
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}`, 'Tus-Resumable': '1.0.0', 'Upload-Length': String(300 * MB) });
    expect(decodeMetadata(init.headers['Upload-Metadata'])).toEqual({ name: 'Evening prayer', maxDurationSeconds: '2100', expiry: '2026-10-07T12:00:00Z' });
    expect(JSON.stringify(init.headers).split(TOKEN)).toHaveLength(2); // once, in Authorization
  });

  it('caps the maximum length at six hours and refuses impossible sizes before asking', async () => {
    const fetchImpl = vi.fn(async () => created());
    await client(fetchImpl).createUpload({ sizeBytes: 10, maxDurationSeconds: 99_999 });
    expect(decodeMetadata(fetchImpl.mock.calls[0][1].headers['Upload-Metadata']).maxDurationSeconds).toBe('21600');
    for (const sizeBytes of [0, -1, 1.5, stream.MAX_UPLOAD_BYTES + 1, '100', undefined]) {
      await expect(client(fetchImpl).createUpload({ sizeBytes }), String(sizeBytes)).rejects.toThrow('Invalid upload size');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reads the video id from stream-media-id, else from the address', async () => {
    const fromPath = await client(vi.fn(async () => created({ location: LOCATION }))).createUpload({ sizeBytes: 5 });
    expect(fromPath.uid).toBe(UID);
    const bad = await client(vi.fn(async () => created({ location: 'https://upload.videodelivery.net/tus/not-an-id' }))).createUpload({ sizeBytes: 5 }).catch((e) => e);
    expect(bad).toBeInstanceOf(stream.StreamError);
    expect(bad.message).toBe('Cloudflare sent no usable video id');
  });

  it('accepts an upload address only on Cloudflare\'s two upload hosts, and never repeats the address in an error', async () => {
    const SECRET_PATH = 'tus/0123456789abcdef0123456789abcdef';
    for (const location of [
      `https://evil.example.com/${SECRET_PATH}`,
      `http://upload.videodelivery.net/${SECRET_PATH}`,
      `https://upload.videodelivery.net.evil.com/${SECRET_PATH}`,
      `https://upload.videodelivery.net:8443/${SECRET_PATH}`,
      `https://user:pw@upload.videodelivery.net/${SECRET_PATH}`,
      `https://upload.videodelivery.net/${SECRET_PATH}#x`,
      `https://upload.videodelivery.net/a%2F..%2F/${SECRET_PATH}`,
      'javascript:alert(1)',
      null,
    ]) {
      const error = await client(vi.fn(async () => created({ ...(location ? { location } : {}), 'stream-media-id': UID }))).createUpload({ sizeBytes: 5 }).catch((e) => e);
      expect(error, String(location)).toBeInstanceOf(stream.StreamError);
      expect(error.message).not.toContain(SECRET_PATH);
    }
    const evil = await client(vi.fn(async () => created({ location: `https://evil.example.com/${SECRET_PATH}`, 'stream-media-id': UID }))).createUpload({ sizeBytes: 5 }).catch((e) => e);
    expect(evil.message).toBe('Cloudflare sent an upload address on an unexpected host (evil.example.com)');
    expect(stream.checkUploadUrl(`https://upload.cloudflarestream.com/tus/${UID}?tusv2=true`)).toBe(`https://upload.cloudflarestream.com/tus/${UID}?tusv2=true`);
  });

  it('turns Cloudflare\'s refusals into StreamErrors without the token', async () => {
    for (const fetchImpl of [
      vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10011, message: 'Storage capacity exceeded' }] }), { status: 403 })),
      vi.fn(async () => new Response('<html>bad gateway</html>', { status: 502 })),
      vi.fn(async () => { throw new TypeError('fetch failed'); }),
    ]) {
      const error = await client(fetchImpl).createUpload({ sizeBytes: 5 }).catch((e) => e);
      expect(error).toBeInstanceOf(stream.StreamError);
      expect(error.message).not.toContain(TOKEN);
    }
    const quota = await client(vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10011, message: 'Storage capacity exceeded' }] }), { status: 403 }))).createUpload({ sizeBytes: 5 }).catch((e) => e);
    expect(quota.message).toBe('Cloudflare Stream POST ?direct_user=true failed (403): 10011 Storage capacity exceeded');
  });

  it('reads a video: state, ready to stream, Cloudflare\'s duration, the customer code from the thumbnail', async () => {
    const fetchImpl = vi.fn(async () => ok({
      uid: UID, readyToStream: true, duration: 1794.6, status: { state: 'ready' },
      thumbnail: `https://customer-abc123.cloudflarestream.com/${UID}/thumbnails/thumbnail.jpg`,
    }));
    await expect(client(fetchImpl).getVideo(UID)).resolves.toEqual({ uid: UID, state: 'ready', readyToStream: true, durationSeconds: 1795, customerCode: 'abc123', errorReason: null });
    expect(fetchImpl.mock.calls[0][0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream/${UID}`);
    expect(fetchImpl.mock.calls[0][1].method).toBe('GET');
    const pending = await client(vi.fn(async () => ok({ uid: UID, readyToStream: false, duration: -1, status: { state: 'pendingupload' } }))).getVideo(UID);
    expect(pending).toMatchObject({ state: 'pendingupload', readyToStream: false, durationSeconds: null, customerCode: null });
    const gone = await client(vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10005, message: 'Not found' }] }), { status: 404 }))).getVideo(UID).catch((e) => e);
    expect(gone.status).toBe(404);
    const never = vi.fn();
    await expect(client(never).getVideo('../../accounts')).rejects.toThrow('Invalid video id');
    expect(never).not.toHaveBeenCalled();
  });

  it('deletes a video (one already gone counts as deleted) and reads the storage use', async () => {
    const del = vi.fn(async () => ok(''));
    await expect(client(del).deleteVideo(UID)).resolves.toEqual({ deleted: true });
    expect(del.mock.calls[0][1].method).toBe('DELETE');
    const gone = vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10005, message: 'Not found' }] }), { status: 404 }));
    await expect(client(gone).deleteVideo(UID)).resolves.toEqual({ deleted: true, missing: true });
    const usage = vi.fn(async () => ok({ creator: null, totalStorageMinutes: 123.4, totalStorageMinutesLimit: 1000, videoCount: 7 }));
    await expect(client(usage).storageUsage()).resolves.toEqual({ minutes: 123.4, limitMinutes: 1000, videos: 7 });
    expect(usage.mock.calls[0][0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream/storage-usage`);
  });

  it('derives the player and the thumbnail of a stored video, and maps Cloudflare\'s states to ours', () => {
    expect(stream.videoPlayerUrl('abc123', UID)).toBe(`https://customer-abc123.cloudflarestream.com/${UID}/iframe`);
    expect(stream.videoThumbnailUrl('abc123', UID)).toBe(`https://customer-abc123.cloudflarestream.com/${UID}/thumbnails/thumbnail.jpg`);
    expect(stream.videoPlayerUrl('', UID)).toBeNull();
    expect(stream.videoPlayerUrl('abc.evil', UID)).toBeNull();
    expect(stream.videoThumbnailUrl('abc123', 'nope')).toBeNull();
    expect(stream.customerCodeOf(`https://customer-abc123.cloudflarestream.com/${UID}/webRTC/play`)).toBe('abc123');
    expect(stream.customerCodeOf('https://evil.example.com/x')).toBeNull();
    const state = (s, ready = false) => stream.recordingStateOf({ state: s, readyToStream: ready });
    expect([state('pendingupload'), state('downloading'), state('queued'), state('inprogress'), state('ready', false), state('ready', true), state('error'), state('new-thing')])
      .toEqual(['uploading', 'processing', 'processing', 'processing', 'processing', 'ready', 'failed', 'uploading']);
  });
});

// ------------------------------------------------------------------ create an upload

describe('POST /admin/live/recordings', () => {
  it('asks Cloudflare for a one-time upload address and gives it to the admin who made the broadcast', async () => {
    const session = await broadcast();
    const res = await create(session);
    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const [uid, video] = [...cf.videos.entries()][0];
    expect(res.body.uploadUrl).toBe(`https://upload.videodelivery.net/tus/${uid}?tusv2=true`);
    expect(res.body.recordingId).toBe(res.body.recording._id);
    expect(res.body.recording).toMatchObject({
      session: session._id, title: 'Evening prayer at the Basilica', liveStartedAt: session.startedAt, durationSeconds: 1800, sizeBytes: 300 * MB,
      mimeType: 'video/webm;codecs=vp9,opus', cfVideoUid: uid, status: 'uploading', failReason: null, published: false, publishedAt: null,
      thumbnailUrl: `https://customer-fake0test.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`,
      playbackUrl: `https://customer-fake0test.cloudflarestream.com/${uid}/iframe`,
      createdBy: { id: editor.admin._id, name: 'rec-editor' },
    });
    expect(res.body.recording.liveEndedAt).toBeTruthy();
    expect(Object.keys(res.body.recording)).not.toContain('uploadUrl');
    // Cloudflare is told the size, a name and a maximum length with a margin (MediaRecorder files often state none).
    expect(video).toMatchObject({ sizeBytes: 300 * MB, name: 'Nazareth Holy Cross: Evening prayer at the Basilica' });
    expect(video.maxDurationSeconds).toBeGreaterThan(1800);
    expect(video.maxDurationSeconds).toBeLessThanOrEqual(21_600);
    expect(new Date(video.expiresAt).getTime() - Date.now()).toBeGreaterThan(3 * 3600_000);
    expect(audits('live.recording_create')[0]).toMatchObject({
      actorName: 'rec-editor', target: { type: 'liveRecording', id: res.body.recordingId }, meta: { session: session._id, videoUid: uid, sizeMb: 300, durationSeconds: 1800 },
    });
  });

  it('the upload address is nowhere else: database, other answers, audit log, server log', async () => {
    const session = await broadcast();
    const res = await create(session);
    const address = res.body.uploadUrl;
    const answers = [
      await list(), await list(owner),
      await call('post', `/admin/live/recordings/${res.body.recordingId}/uploaded`, editor, {}),
      await call('patch', `/admin/live/recordings/${res.body.recordingId}`, editor, { title: 'Renamed' }),
      await create(session), // the 409 for a second one
      await publicList(),
    ];
    for (const a of answers) expect(JSON.stringify(a.body)).not.toContain('upload.videodelivery.net');
    expect(everythingStored()).not.toContain(address);
    expect(everythingStored()).not.toContain('upload.videodelivery.net');
  });

  it('an editor uploads only for a broadcast they made; an owner for any', async () => {
    const session = await broadcast(editor);
    const other = await create(session, editor2);
    expect(other.status).toBe(403);
    expect(other.body.error).toMatch(/Only the person who made this broadcast, or an owner/);
    expect(cf.calls.filter((c) => c.op === 'createUpload')).toHaveLength(0);
    expect((await create(session, owner)).status).toBe(201);
  });

  it('one recording per broadcast: a second one is 409 with the first; two at the same moment leave one and no stray video', async () => {
    const session = await broadcast();
    const first = await create(session);
    const second = await create(session);
    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ error: 'This broadcast already has a recording', recording: { _id: first.body.recordingId } });

    const next = await broadcast(editor, 'Second');
    const [a, b] = await Promise.all([create(next), create(next)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(fakes.LiveRecording.docs.filter((d) => String(d.session) === next._id)).toHaveLength(1);
    expect(cf.videos.size).toBe(2); // the loser's video was deleted again
  });

  it('an unknown broadcast is 404; Cloudflare not configured is 503; Cloudflare refusing is 502, audited and logged, nothing saved', async () => {
    const session = await broadcast();
    expect((await call('post', '/admin/live/recordings', editor, { ...UPLOAD, sessionId: '64b000000000000000000099' })).status).toBe(404);
    cf.fail.upload = true;
    const refused = await create(session);
    expect(refused.status).toBe(502);
    expect(refused.body.error).toMatch(/Cloudflare Stream could not prepare the upload/);
    expect(fakes.LiveRecording.docs).toHaveLength(0);
    expect(audits('live.recording_failed')).toHaveLength(1);
    expect(logs.join('\n')).toMatch(/\[live\] upload address refused by Cloudflare/);
    stream.setStreamClient(null);
    expect((await create(session)).status).toBe(503);
    expect((await list()).body.configured).toBe(false);
  });

  it('validates the body: a broadcast id, a whole size, a length up to six hours, a video type, an optional title; nothing else', async () => {
    const session = await broadcast();
    const base = { sessionId: session._id, ...UPLOAD };
    for (const body of [
      {}, { ...base, sessionId: 'nope' }, { ...base, sessionId: { $ne: null } }, { ...base, sizeBytes: 0 }, { ...base, sizeBytes: 1.5 },
      { ...base, sizeBytes: '300' }, { ...base, sizeBytes: 31 * 1024 ** 3 }, { ...base, durationSeconds: -1 }, { ...base, durationSeconds: 21_601 },
      { ...base, mimeType: 'text/html' }, { ...base, mimeType: 'video/webm;codecs=vp9!' }, { ...base, mimeType: 'video/ogg' }, { ...base, title: '' },
      { ...base, title: 'x'.repeat(121) }, { ...base, uploadUrl: 'https://evil.example.com' }, { ...base, status: 'ready' },
    ]) {
      expect((await call('post', '/admin/live/recordings', editor, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(cf.calls.filter((c) => c.op === 'createUpload')).toHaveLength(0);
    for (const [i, mimeType] of ['video/mp4', 'video/webm;codecs="vp8,opus"', 'video/x-matroska;codecs=avc1,opus', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'].entries()) {
      const s = await broadcast(editor, `Type ${i}`);
      const res = await create(s, editor, { mimeType, title: `Own title ${i}` });
      expect(res.status, mimeType).toBe(201);
      expect(res.body.recording.title).toBe(`Own title ${i}`);
      expect(res.body.recording.mimeType).toBe(mimeType);
    }
  });
});

// ------------------------------------------------------------------ the upload finished, Cloudflare processes it

describe('uploaded, processing, ready (and the status check against Cloudflare)', () => {
  it('"uploaded" moves it to processing (once), audited; Cloudflare then makes it ready with its own duration', async () => {
    const session = await broadcast();
    const { body } = await create(session);
    const done = await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, editor, {});
    expect(done.status).toBe(200);
    expect(done.body.recording.status).toBe('processing');
    const again = await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, editor, {});
    expect(again.body.recording.status).toBe('processing');
    expect(audits('live.recording_uploaded')).toHaveLength(1);

    cf.setVideoState(body.recording.cfVideoUid, 'inprogress');
    expect((await list()).body.items[0].status).toBe('processing');
    vi.useFakeTimers({ now: Date.now() + 11_000, toFake: ['Date'] });
    cf.setVideoState(body.recording.cfVideoUid, 'ready', { durationSeconds: 1793 });
    const ready = (await list()).body.items[0];
    expect(ready).toMatchObject({ status: 'ready', durationSeconds: 1793, published: false });
    expect(audits('live.recording_status').map((a) => a.meta)).toEqual([{ from: 'processing', to: 'ready', videoUid: body.recording.cfVideoUid }]);
    expect(audits('live.recording_status')[0].actorName).toBe('system');
  });

  it('a short video that is ready at once is ready in the answer to "uploaded"', async () => {
    const session = await broadcast();
    const { body } = await create(session);
    cf.setVideoState(body.recording.cfVideoUid, 'ready', { durationSeconds: 42 });
    const done = await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, editor, {});
    expect(done.body.recording).toMatchObject({ status: 'ready', durationSeconds: 42 });
  });

  it('asks Cloudflare at most every ten seconds per video, and never moves a recording backwards', async () => {
    const session = await broadcast();
    const { body } = await create(session);
    await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, editor, {});
    const checks = () => cf.calls.filter((c) => c.op === 'getVideo').length;
    const before = checks();
    await list();
    await list();
    expect(checks()).toBe(before); // "uploaded" checked a moment ago
    vi.useFakeTimers({ now: Date.now() + 11_000, toFake: ['Date'] });
    await list();
    expect(checks()).toBe(before + 1);
    // Cloudflare still says "pendingupload": the browser said the upload finished, so it stays "processing".
    expect(fakes.LiveRecording.byId(body.recordingId).status).toBe('processing');
  });

  it('Cloudflare failing to encode makes it failed (and unpublished); a processing video missing at Cloudflare too', async () => {
    const one = await readyRecording(editor, 'One');
    await call('patch', `/admin/live/recordings/${one.recording._id}`, editor, { published: true });
    // a second recording, still processing, that Cloudflare cannot encode
    const session = await broadcast(editor, 'Two');
    const { body } = await create(session);
    await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, editor, {});
    cf.setVideoState(body.recording.cfVideoUid, 'error');
    // a third one, processing, deleted at Cloudflare by hand
    const s3 = await broadcast(editor, 'Three');
    const third = await create(s3);
    await call('post', `/admin/live/recordings/${third.body.recordingId}/uploaded`, editor, {});
    cf.videos.delete(third.body.recording.cfVideoUid);
    vi.useFakeTimers({ now: Date.now() + 11_000, toFake: ['Date'] });
    const items = Object.fromEntries((await list()).body.items.map((r) => [r.title, r]));
    expect(items.Two).toMatchObject({ status: 'failed', failReason: 'Cloudflare could not encode it (ERR_NON_VIDEO)', published: false });
    expect(items.Three).toMatchObject({ status: 'failed', failReason: 'missing at Cloudflare' });
    expect(items.One).toMatchObject({ status: 'ready', published: true }); // a ready one is not asked again
    expect((await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, editor, {})).status).toBe(409);
  });

  it('an upload address nobody used is left alone for two days, then given up', async () => {
    const session = await broadcast();
    const { body } = await create(session);
    cf.videos.delete(body.recording.cfVideoUid); // Cloudflare forgot the unused address
    expect((await list()).body.items[0].status).toBe('uploading');
    Object.assign(fakes.LiveRecording.byId(body.recordingId), { createdAt: new Date(Date.now() - 49 * 3600_000), checkedAt: null });
    expect((await list()).body.items[0]).toMatchObject({ status: 'failed', failReason: 'missing at Cloudflare' });
  });

  it('a Cloudflare outage during the check changes nothing', async () => {
    const session = await broadcast();
    const { body } = await create(session);
    await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, editor, {});
    cf.fail.getVideo = true;
    vi.useFakeTimers({ now: Date.now() + 11_000, toFake: ['Date'] });
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.items[0].status).toBe('processing');
  });

  it('a new upload address for an unfinished upload: new video, the old one deleted, audited; not for a finished one', async () => {
    const session = await broadcast();
    const { body } = await create(session);
    const oldUid = body.recording.cfVideoUid;
    const renewed = await call('post', `/admin/live/recordings/${body.recordingId}/upload-url`, editor, { sizeBytes: 200 * MB });
    expect(renewed.status).toBe(200);
    expect(renewed.body.recording.cfVideoUid).not.toBe(oldUid);
    expect(renewed.body.uploadUrl).toBe(`https://upload.videodelivery.net/tus/${renewed.body.recording.cfVideoUid}?tusv2=true`);
    expect(renewed.body.recording).toMatchObject({ status: 'uploading', sizeBytes: 200 * MB, durationSeconds: 1800 });
    expect(cf.videos.has(oldUid)).toBe(false);
    expect(audits('live.recording_renew')[0].meta).toMatchObject({ oldVideoUid: oldUid, oldDeleted: true });
    expect(everythingStored()).not.toContain(renewed.body.uploadUrl);
    expect((await call('post', `/admin/live/recordings/${body.recordingId}/upload-url`, editor2, { sizeBytes: 5 })).status).toBe(403);
    await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, editor, {});
    expect((await call('post', `/admin/live/recordings/${body.recordingId}/upload-url`, editor, { sizeBytes: 5 })).status).toBe(409);
    expect((await call('post', '/admin/live/recordings/64b000000000000000000099/upload-url', editor, { sizeBytes: 5 })).status).toBe(404);
    expect((await call('post', `/admin/live/recordings/${body.recordingId}/upload-url`, editor, { sizeBytes: 0 })).status).toBe(400);
  });

  it('only the admin who made the broadcast (or an owner) says the upload finished', async () => {
    const session = await broadcast(editor);
    const { body } = await create(session);
    expect((await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, editor2, {})).status).toBe(403);
    expect((await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, owner, {})).status).toBe(200);
    expect((await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, owner, { extra: 1 })).status).toBe(400);
  });
});

// ------------------------------------------------------------------ the list, storage, rename, publish, delete

describe('GET /admin/live/recordings', () => {
  it('newest broadcast first, with the stored minutes from Cloudflare (or an estimate when it does not answer)', async () => {
    const first = await readyRecording(editor, 'First');
    const second = await readyRecording(editor, 'Second');
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(res.body.items.map((r) => r.title)).toEqual(['Second', 'First']);
    expect(res.body.storage).toEqual({ usedMinutes: 60, limitMinutes: 1000, videos: 2, source: 'cloudflare', pricePer1000Minutes: 5 });
    expect([first, second]).toHaveLength(2);

    recordings.resetStorageCache();
    cf.fail.storage = true;
    expect((await list()).body.storage).toEqual({ usedMinutes: 60, limitMinutes: 1000, videos: 2, source: 'estimate', pricePer1000Minutes: 5 });
  });
});

describe('PATCH /admin/live/recordings/:id', () => {
  it('publishes only a ready recording; unpublishing and renaming always work; every change audited', async () => {
    const session = await broadcast();
    const { body } = await create(session);
    const early = await call('patch', `/admin/live/recordings/${body.recordingId}`, editor, { published: true });
    expect(early.status).toBe(409);
    expect(early.body.error).toMatch(/not ready yet/);
    await call('post', `/admin/live/recordings/${body.recordingId}/uploaded`, editor, {});
    cf.setVideoState(body.recording.cfVideoUid, 'ready', { durationSeconds: 600 });
    // ready at Cloudflare a moment ago: publishing checks again instead of refusing
    const published = await call('patch', `/admin/live/recordings/${body.recordingId}`, editor2, { published: true });
    expect(published.status).toBe(200);
    expect(published.body.recording).toMatchObject({ status: 'ready', published: true });
    expect(published.body.recording.publishedAt).toBeTruthy();
    const renamed = await call('patch', `/admin/live/recordings/${body.recordingId}`, editor, { title: 'Vespers & Mass <script>x</script>' });
    expect(renamed.body.recording.title).toBe('Vespers &amp; Mass'); // the sanitizer of every route: tags out, & escaped
    const hidden = await call('patch', `/admin/live/recordings/${body.recordingId}`, editor, { published: false });
    expect(hidden.body.recording).toMatchObject({ published: false, publishedAt: null });
    expect(audits('live.recording_update').map((a) => a.meta)).toEqual([{ published: true }, { title: renamed.body.recording.title }, { published: false }]);
    expect(audits('live.recording_update')[0].actorName).toBe('rec-editor-2');
  });

  it('validates the body and the id', async () => {
    const { recording } = await readyRecording();
    for (const body of [{}, { title: '' }, { title: 'x'.repeat(121) }, { published: 'yes' }, { status: 'ready' }, { cfVideoUid: 'a'.repeat(32) }]) {
      expect((await call('patch', `/admin/live/recordings/${recording._id}`, editor, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await call('patch', '/admin/live/recordings/64b000000000000000000099', editor, { title: 'x' })).status).toBe(404);
    expect((await call('patch', '/admin/live/recordings/not-an-id', editor, { title: 'x' })).status).toBe(404);
  });
});

describe('DELETE /admin/live/recordings/:id', () => {
  it('deletes the recording and its Cloudflare video, audited; any editor or owner may', async () => {
    const { recording } = await readyRecording();
    const res = await call('delete', `/admin/live/recordings/${recording._id}`, editor2);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true, cloudflareDeleted: true });
    expect(fakes.LiveRecording.docs).toHaveLength(0);
    expect(cf.videos.has(recording.cfVideoUid)).toBe(false);
    expect(audits('live.recording_delete')[0]).toMatchObject({ actorName: 'rec-editor-2', meta: { title: recording.title, videoUid: recording.cfVideoUid, cloudflareDeleted: true } });
    expect((await call('delete', `/admin/live/recordings/${recording._id}`, owner)).status).toBe(404);
  });

  it('when Cloudflare cannot delete the video the recording is still removed, and the log names the video', async () => {
    const { recording } = await readyRecording();
    cf.fail.deleteVideo = true;
    const res = await call('delete', `/admin/live/recordings/${recording._id}`, owner);
    expect(res.body).toEqual({ deleted: true, cloudflareDeleted: false });
    expect(logs.join('\n')).toContain(`could not delete the Cloudflare video ${recording.cfVideoUid}`);
  });
});

// ------------------------------------------------------------------ the website's list

describe('GET /live/recordings (public)', () => {
  it('lists only published and ready recordings, newest first, with nothing private', async () => {
    const a = await readyRecording(editor, 'Morning Mass');
    const b = await readyRecording(editor, 'Evening prayer');
    await readyRecording(editor, 'Not published'); // ready, never published
    const s = await broadcast(editor, 'Still processing');
    const processing = await create(s);
    await call('post', `/admin/live/recordings/${processing.body.recordingId}/uploaded`, editor, {});
    for (const r of [a, b]) await call('patch', `/admin/live/recordings/${r.recording._id}`, editor, { published: true });

    const res = await publicList();
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30, s-maxage=30, stale-while-revalidate=60, stale-if-error=600');
    expect(res.headers.ratelimit).toMatch(/limit=1000/);
    expect(res.body.items).toEqual([b, a].map(({ session, recording }) => ({
      id: recording._id, title: recording.title, date: session.startedAt, durationSeconds: 1795,
      thumbnailUrl: `https://customer-fake0test.cloudflarestream.com/${recording.cfVideoUid}/thumbnails/thumbnail.jpg`,
      playbackUrl: `https://customer-fake0test.cloudflarestream.com/${recording.cfVideoUid}/iframe`,
    })));
  });

  it('is answered from memory, and follows publishing, unpublishing and deleting at once', async () => {
    const { recording } = await readyRecording();
    expect((await publicList()).body.items).toHaveLength(0);
    await call('patch', `/admin/live/recordings/${recording._id}`, editor, { published: true });
    expect((await publicList()).body.items).toHaveLength(1);
    fakes.LiveRecording.calls.length = 0;
    for (let i = 0; i < 4; i += 1) await publicList();
    expect(fakes.LiveRecording.calls.filter((c) => c.op === 'find')).toHaveLength(0);
    await call('patch', `/admin/live/recordings/${recording._id}`, editor, { published: false });
    expect((await publicList()).body.items).toHaveLength(0);
    await call('patch', `/admin/live/recordings/${recording._id}`, editor, { published: true });
    await call('delete', `/admin/live/recordings/${recording._id}`, editor);
    expect((await publicList()).body.items).toHaveLength(0);
  });

  it('a published recording that Cloudflare later fails, or whose player cannot be built, is not listed', async () => {
    const { recording } = await readyRecording();
    await call('patch', `/admin/live/recordings/${recording._id}`, editor, { published: true });
    fakes.LiveRecording.byId(recording._id).customerCode = 'bad.code';
    recordings.resetRecordingsCache();
    expect((await publicList()).body.items).toHaveLength(0);
  });
});

// ------------------------------------------------------------------ roles and queries

describe('roles', () => {
  it('a viewer gets 403 and no token 401 on every recordings route, and nothing happens', async () => {
    const ID = '64b000000000000000000001';
    const routes = [
      ['get', '/admin/live/recordings'], ['post', '/admin/live/recordings', { sessionId: ID, ...UPLOAD }],
      ['post', `/admin/live/recordings/${ID}/upload-url`, { sizeBytes: 5 }], ['post', `/admin/live/recordings/${ID}/uploaded`, {}],
      ['patch', `/admin/live/recordings/${ID}`, { title: 'x' }], ['delete', `/admin/live/recordings/${ID}`],
    ];
    for (const [method, path, body] of routes) {
      expect((await call(method, path, viewer, body)).status, `${method} ${path}`).toBe(403);
      expect((await call(method, path, null, body)).status, `${method} ${path}`).toBe(401);
    }
    expect(cf.calls).toHaveLength(0);
    expect(audits()).toHaveLength(0);
  });
});

describe('database queries', () => {
  it('every LiveRecording filter survives sanitizeFilter and casts against the real schema', async () => {
    fakes.LiveRecording.calls.length = 0;
    const { recording } = await readyRecording();
    await call('patch', `/admin/live/recordings/${recording._id}`, editor, { published: true });
    await publicList();
    recordings.resetStorageCache();
    cf.fail.storage = true;
    await list();
    await call('delete', `/admin/live/recordings/${recording._id}`, editor);
    const filters = allFilters().filter((f) => f.name === 'LiveRecording');
    expect(filters.length).toBeGreaterThan(5);
    for (const { op, filter } of filters) {
      expect(sanitizeChanges(filter), `${op} ${JSON.stringify(filter)}`).toBeNull();
      expect(await castProblem('LiveRecording', filter), `${op} ${JSON.stringify(filter)}`).toBeNull();
    }
  });
});
