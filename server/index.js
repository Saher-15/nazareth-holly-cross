import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config, missingEnv, secretProblems } from './config/env.js';
import { applyMongooseSafety } from './config/mongoose.js';

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

function connectDB() {
  mongoose.connect(config.databaseUrl, { serverSelectionTimeoutMS: 10000 })
    .then(() => console.log('DB connected'))
    .catch(err => {
      console.error('DB failed to connect, retrying in 10s:', err.message);
      setTimeout(connectDB, 10000);
    });
}
connectDB();

const app = createApp();
app.listen(config.port, () => console.log(`Server running on port ${config.port} (PayPal: ${config.paypal.environment})`));
