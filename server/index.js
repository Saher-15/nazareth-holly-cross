import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createApp } from './app.js';

dotenv.config();

// Validate required env vars at startup
const required = ['DATABASEURL', 'JWT_SECRET', 'ADMIN_PASSWORD', 'MAIL_FROM', 'MAIL_APP_PASSWORD', 'CLIENT_ID', 'CLIENT_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

function connectDB() {
  mongoose.connect(process.env.DATABASEURL, { serverSelectionTimeoutMS: 10000 })
    .then(() => console.log('DB connected'))
    .catch(err => {
      console.error('DB failed to connect, retrying in 10s:', err.message);
      setTimeout(connectDB, 10000);
    });
}
connectDB();

const app = createApp();
app.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));
