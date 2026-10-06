import mongoose from 'mongoose';
import './config/indexPolicy.js'; // must run before any model is compiled (autoIndex is off in production)
import { createApp } from './app.js';
import { config, missingEnv, secretProblems } from './config/env.js';
import { applyMongooseSafety } from './config/mongoose.js';
import { MODELS, planIndexes, problemsIn } from './services/indexes.js';
import { streamConfigured } from './services/cloudflareStream.js';
import { endStaleSessions } from './services/live.js';

// Validate required env vars at startup
const missing = missingEnv();
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// Weak or example secrets: always logged (names only, never values); placeholders and a reused secret stop
// the server in production.
for (const { fatal, message } of secretProblems()) {
  console.error(`${fatal && config.isProd ? 'FATAL' : 'WARNING'}: ${message}`);
  if (fatal && config.isProd) process.exit(1);
}

applyMongooseSafety();

// In production the server does not build indexes by itself (config/indexPolicy.js): say so when the database lacks
// one. Never fatal and never blocks start-up; the fix is `node scripts/ensure-indexes.js --apply` (docs/DATABASE.md).
async function warnAboutMissingIndexes() {
  if (!config.isProd) return;
  try {
    const problems = problemsIn(await planIndexes(mongoose.connection.db, MODELS));
    if (problems.length) {
      const list = problems.slice(0, 12).map((p) => `${p.collection}.${p.index} (${p.kind})`).join(', ');
      console.error(`WARNING: ${problems.length} database index(es) missing or different: ${list}. Run: node scripts/ensure-indexes.js --apply`);
    }
  } catch (err) {
    console.error('Could not check the database indexes:', err.message);
  }
}

function connectDB() {
  mongoose.connect(config.databaseUrl, { serverSelectionTimeoutMS: 10000 })
    .then(() => {
      console.log('DB connected');
      return warnAboutMissingIndexes();
    })
    .catch(err => {
      console.error('DB failed to connect, retrying in 10s:', err.message);
      setTimeout(connectDB, 10000);
    });
}
connectDB();

const app = createApp();
const server = app.listen(config.port, () => console.log(`Server running on port ${config.port} (PayPal: ${config.paypal.environment}, live broadcasting: ${streamConfigured() ? 'configured' : 'not configured'})`));

// A live broadcast nobody stopped (the admin's phone died, the tab was closed without the stop arriving) ends by itself
// after LIVE_MAX_MS. The reads of the status do it too; this timer covers the hours when nobody looks (docs/LIVE.md).
setInterval(() => {
  if (mongoose.connection.readyState !== 1) return;
  endStaleSessions().catch((err) => console.error('[live] automatic end failed:', err.message));
}, 10 * 60_000).unref();

process.on('unhandledRejection', (reason) => {
  console.error(`[${new Date().toISOString()}] Unhandled rejection:`, reason);
});

// Render sends SIGTERM when it replaces the service: finish the requests in flight, then close the database.
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
});
