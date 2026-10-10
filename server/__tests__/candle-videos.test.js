import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));
const { fakes } = await import('./helpers/fakes.js');
const { freshIp, signedIn, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { signSessionToken } = await import('../services/adminSessions.js');
const stream = await import('../services/cloudflareStream.js');
const { fakeStreamClient } = await import('../test-harness/fake-cloudflare.js');
const { resetCandleVideosCache, MAX_CANDLE_VIDEOS } = await import('../services/candleVideos.js');
const { http, close } = startClient(createApp());
afterAll(() => { stream.setStreamClient(null); close(); });

let cf;
const as = async (role) => (await signedIn(signSessionToken, { role })).auth;
const call = (method, path, auth, body) => http[method](path).set('X-Forwarded-For', freshIp()).set(auth ?? {}).send(body);
const file = { title: 'Lighting the candles', sizeBytes: 5_000_000, mimeType: 'video/quicktime' };

beforeEach(() => {
  fakes.CandleVideo.reset(); fakes.Admin.reset(); fakes.AdminSession.reset(); fakes.AuditLog.reset();
  resetCandleVideosCache();
  cf = fakeStreamClient();
  stream.setStreamClient(cf);
});

describe('candle page videos', () => {
  it('an editor uploads, it becomes ready, is published, and the website lists it', async () => {
    const auth = await as('editor');
    const created = await call('post', '/admin/candle-videos', auth, file);
    expect(created.status).toBe(201);
    expect(created.body.uploadUrl).toMatch(/^https:\/\//);
    const { id } = created.body.video;
    expect(created.body.video).toMatchObject({ title: file.title, status: 'uploading', published: false });

    // Published too early: refused.
    expect((await call('patch', `/admin/candle-videos/${id}`, auth, { published: true })).status).toBe(409);

    const uid = fakes.CandleVideo.docs[0].cfVideoUid;
    cf.setVideoState(uid, 'ready', { durationSeconds: 42 });
    const uploaded = await call('post', `/admin/candle-videos/${id}/uploaded`, auth, {});
    expect(uploaded.body.video).toMatchObject({ status: 'ready', durationSeconds: 42 });
    expect(uploaded.body.video.playbackUrl).toMatch(/cloudflarestream\.com/);

    expect((await http.get('/candle/videos')).body).toEqual([]); // ready, not yet published
    const pub = await call('patch', `/admin/candle-videos/${id}`, auth, { published: true });
    expect(pub.body.video.published).toBe(true);
    const list = await http.get('/candle/videos');
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id, title: file.title, durationSeconds: 42 });
    expect(Object.keys(list.body[0]).sort()).toEqual(['durationSeconds', 'id', 'playbackUrl', 'thumbnailUrl', 'title']);
    expect(fakes.AuditLog.docs.map((a) => a.action)).toEqual(expect.arrayContaining(['candle_video.create', 'candle_video.update']));
  });

  it('a viewer reads the list but cannot upload, publish or delete', async () => {
    const editor = await as('editor');
    const { id } = (await call('post', '/admin/candle-videos', editor, file)).body.video;
    const viewer = await as('viewer');
    expect((await call('get', '/admin/candle-videos', viewer)).body.items).toHaveLength(1);
    expect((await call('post', '/admin/candle-videos', viewer, file)).status).toBe(403);
    expect((await call('patch', `/admin/candle-videos/${id}`, viewer, { title: 'x' })).status).toBe(403);
    expect((await call('delete', `/admin/candle-videos/${id}`, viewer)).status).toBe(403);
  });

  it('delete removes it here and at Cloudflare, and from the website', async () => {
    const auth = await as('owner');
    const { id } = (await call('post', '/admin/candle-videos', auth, file)).body.video;
    const uid = fakes.CandleVideo.docs[0].cfVideoUid;
    cf.setVideoState(uid, 'ready', { durationSeconds: 5 });
    await call('post', `/admin/candle-videos/${id}/uploaded`, auth, {});
    await call('patch', `/admin/candle-videos/${id}`, auth, { published: true });
    const del = await call('delete', `/admin/candle-videos/${id}`, auth);
    expect(del.body).toEqual({ deleted: true });
    expect(cf.videos.has(uid)).toBe(false);
    expect((await http.get('/candle/videos')).body).toEqual([]);
  });

  it.each([
    ['a non-video file', { ...file, mimeType: 'application/pdf' }],
    ['a file over 2 GB', { ...file, sizeBytes: 3 * 1024 ** 3 }],
    ['no title', { sizeBytes: 1, mimeType: 'video/mp4' }],
    ['an unknown field', { ...file, extra: 1 }],
  ])('refuses %s', async (_, body) => {
    expect((await call('post', '/admin/candle-videos', await as('editor'), body)).status).toBe(400);
    expect(fakes.CandleVideo.docs).toHaveLength(0);
  });

  it(`keeps at most ${MAX_CANDLE_VIDEOS} videos`, async () => {
    fakes.CandleVideo.seed(Array.from({ length: MAX_CANDLE_VIDEOS }, (_, i) => ({ title: `v${i}`, cfVideoUid: `u${i}`, status: 'ready' })));
    expect((await call('post', '/admin/candle-videos', await as('editor'), file)).status).toBe(409);
  });

  it('says so when Cloudflare Stream is not set up (503), and fails without a database row when Cloudflare refuses (502)', async () => {
    const auth = await as('editor');
    stream.setStreamClient(null);
    expect((await call('post', '/admin/candle-videos', auth, file)).status).toBe(503);
    stream.setStreamClient({ ...cf, createUpload: async () => { throw new Error('down'); } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call('post', '/admin/candle-videos', auth, file)).status).toBe(502);
    expect(fakes.CandleVideo.docs).toHaveLength(0);
  });
});
