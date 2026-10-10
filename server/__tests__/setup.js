// Env the routes read at import time; no real services are contacted in tests.
process.env.NODE_ENV = 'test';
process.env.REQUIRE_PAYMENT_PROOF = 'false'; // explicit local compatibility fixtures; production cannot opt out
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
delete process.env.ADMIN_PASSWORD; // no longer read by the server (the legacy shared-password sign-in was removed)
process.env.MAIL_FROM = 'test@example.com';
process.env.MAIL_APP_PASSWORD = 'x';
process.env.CLIENT_ID = 'test-client-id';
process.env.CLIENT_SECRET = 'test-client-secret';
process.env.DATABASEURL = 'mongodb://127.0.0.1:1/unused';

// The payment ledger (model/payment.js) is written by the payment routes. Tests never talk to MongoDB, so every test
// file gets an in-memory Payment unless it mocks the model itself.
import { vi } from 'vitest';

vi.mock('../model/payment.js', async (importOriginal) => {
  const { fakeModule } = await import('./helpers/fakes.js');
  // The constants (PAYMENT_GRACE_MS, PAYMENT_TYPES, ...) stay real; only the model is replaced.
  return {
    ...(await importOriginal()),
    ...fakeModule('Payment', {
      collection: 'payment',
      timestamps: true,
      unique: ['paypalOrderId'],
      defaults: { currency: 'USD', status: 'created', capturedAt: null, resolvedAt: null },
    }),
  };
});

// The live broadcast sessions (model/liveSession.js), for the same reason: route/admin/live.js and route/liveRoute.js are
// part of every app the tests build. The Cloudflare client is never real in a test: without CF_* variables the feature
// is "not configured", and the live tests install test-harness/fake-cloudflare.js.
vi.mock('../model/liveSession.js', async (importOriginal) => {
  const { fakeModule } = await import('./helpers/fakes.js');
  return {
    ...(await importOriginal()),
    ...fakeModule('LiveSession', {
      collection: 'liveSession',
      timestamps: true,
      unique: [{ field: 'status', only: 'live' }],
      defaults: { status: 'live', endedAt: null, endReason: null, inputDeleted: false },
    }),
  };
});
// The recordings of broadcasts and the scheduled broadcasts (model/liveRecording.js, model/scheduledBroadcast.js): the
// same, since route/admin/live.js mounts their routes and route/liveRoute.js their public lists.
vi.mock('../model/liveRecording.js', async (importOriginal) => {
  const { fakeModule } = await import('./helpers/fakes.js');
  const { RECORDING_DEFAULTS } = await import('../test-harness/live-defaults.js');
  return { ...(await importOriginal()), ...fakeModule('LiveRecording', { collection: 'liveRecording', timestamps: true, unique: ['session'], defaults: RECORDING_DEFAULTS }) };
});
vi.mock('../model/scheduledBroadcast.js', async (importOriginal) => {
  const { fakeModule } = await import('./helpers/fakes.js');
  const { SCHEDULE_DEFAULTS } = await import('../test-harness/live-defaults.js');
  return { ...(await importOriginal()), ...fakeModule('ScheduledBroadcast', { collection: 'scheduledBroadcast', timestamps: true, defaults: SCHEDULE_DEFAULTS }) };
});
// The site settings (model/siteSetting.js, services/siteSettings.js): in memory, so the candle price can be changed in tests.
vi.mock('../model/siteSetting.js', async (importOriginal) => {
  const { fakeModule } = await import('./helpers/fakes.js');
  return { ...(await importOriginal()), ...fakeModule('SiteSetting', { collection: 'siteSetting', timestamps: true, unique: ['key'] }) };
});
// The funnel counters (model/metric.js, services/metrics.js): in memory.
vi.mock('../model/metric.js', async (importOriginal) => {
  const { fakeModule } = await import('./helpers/fakes.js');
  return { ...(await importOriginal()), ...fakeModule('Metric', { collection: 'metric', autoCreatedAt: false, defaults: { source: '', medium: '', campaign: '', count: 0 } }) };
});
vi.mock('../model/candleVideo.js', async (importOriginal) => {
  const { fakeModule } = await import('./helpers/fakes.js');
  return { ...(await importOriginal()), ...fakeModule('CandleVideo', { collection: 'candleVideo', timestamps: true, defaults: { status: 'uploading', published: false, publishedAt: null, failReason: null, customerCode: '', durationSeconds: 0 } }) };
});
delete process.env.CF_ACCOUNT_ID;
delete process.env.CF_STREAM_API_TOKEN;
