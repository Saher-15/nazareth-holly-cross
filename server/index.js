import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config, missingEnv } from './config/env.js';

// Validate required env vars at startup
const missing = missingEnv();
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

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
const server = app.listen(config.port, () => console.log(`Server running on port ${config.port} (PayPal: ${config.paypal.environment})`));

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
