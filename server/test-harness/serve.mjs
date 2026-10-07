// The local API harness: the REAL Express app (app.js createApp) over in-memory fakes of the Mongoose models.
//
//   node server/test-harness/serve.mjs            -> http://127.0.0.1:3912
//
// Never reads a .env, never opens a network connection to a real service (no MongoDB, no SMTP, no PayPal), uses a
// random throw-away JWT_SECRET. See test-harness/README.md.
import crypto from 'node:crypto';

// A harness has its own environment; nothing from the shell's real configuration is trusted or used.
for (const key of ['DATABASEURL', 'MAIL_FROM', 'MAIL_APP_PASSWORD', 'CLIENT_ID', 'CLIENT_SECRET', 'ADMIN_PASSWORD', 'JWT_SECRET', 'CLIENT_URL', 'EXTRA_ORIGINS', 'CF_ACCOUNT_ID', 'CF_STREAM_API_TOKEN']) {
  delete process.env[key];
}
process.env.NODE_ENV = process.env.HARNESS_NODE_ENV ?? 'production'; // behave like the deployed server (no stack traces)
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex'); // throw-away: a restart signs everyone out
process.env.ADMIN_PASSWORD = crypto.randomBytes(18).toString('hex'); // the legacy shared password, unusable by anyone
process.env.DATABASEURL = 'mongodb://harness.invalid/none'; // never connected to
process.env.MAIL_FROM = 'harness@example.invalid';
process.env.MAIL_APP_PASSWORD = 'unused';
process.env.CLIENT_ID = 'unused';
process.env.CLIENT_SECRET = 'unused';
process.env.HARNESS ??= '1';
// The seed's and the tests' product photos are local addresses: accept them although the harness runs as production.
process.env.PRODUCT_IMAGE_LOCAL ??= '1';
process.env.ADMIN_ORIGINS ??= `http://localhost:${process.env.HARNESS_ADMIN_PORT ?? 3911}`;
// The password-reset e-mail links to the local dashboard, never to a real one (the mail is only recorded anyway).
process.env.ADMIN_APP_URL = `http://localhost:${process.env.HARNESS_ADMIN_PORT ?? 3911}`;

await import('./hooks.mjs'); // must run before anything that imports a model, the mailer or dotenv
const { default: express } = await import('express');
const { createApp } = await import('../app.js');
const { seed } = await import('./seed.mjs');
// Live broadcasting talks to a fake Cloudflare Stream (fake-cloudflare.js): never to Cloudflare.
const { setStreamClient } = await import('../services/cloudflareStream.js');
const { fakeStreamClient } = await import('./fake-cloudflare.js');
const { state } = await import('./harness-models.js');
state.stream = fakeStreamClient({ customerCode: 'harness' });
setStreamClient(state.stream);

const port = Number(process.env.HARNESS_PORT ?? 3912);
const host = '127.0.0.1';

const outer = express();
outer.disable('x-powered-by');
if (process.env.HARNESS === '1') {
  const { controlRouter } = await import('./control.js');
  outer.use('/__harness', controlRouter());
}
outer.use(createApp());

const started = await seed();
const server = outer.listen(port, host, () => {
  console.log(`[harness] real admin API on http://${host}:${port} (in-memory data: ${started.products} products, ${started.orders} orders, ${started.accounts} accounts)`);
  console.log(`[harness] test hooks ${process.env.HARNESS === '1' ? 'ON (/__harness/*)' : 'off'}; accounts and passwords: server/test-harness/README.md`);
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
