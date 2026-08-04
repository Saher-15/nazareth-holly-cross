import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import { xss } from 'express-xss-sanitizer';
import mongoSanitize from 'express-mongo-sanitize';
import routerOrder from './route/orderRoute.js';
import routerProduct from './route/productRoute.js';
import routerCandle from './route/candleRoute.js';
import routerContact from './route/contactRoute.js';
import routerLive from './route/liveRoute.js';
import routerAuth from './route/authRoute.js';
import routerAdmin from './route/adminRoute.js';
import { globalLimiter } from './utils/security.js';

dotenv.config();

// Validate required env vars at startup
const required = ['DATABASEURL', 'JWT_SECRET', 'ADMIN_PASSWORD', 'MAIL_FROM', 'MAIL_APP_PASSWORD', 'CLIENT_ID', 'CLIENT_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

mongoose.connect(process.env.DATABASEURL)
  .then(() => console.log('DB connected'))
  .catch(err => { console.error('DB failed to connect:', err); process.exit(1); });

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));
app.use(xss());
app.use(mongoSanitize()); // strip MongoDB operators ($where, $gt, etc.) from req.body/params/query
app.use(globalLimiter);

app.use('/auth', routerAuth);
app.use('/product', routerProduct);
app.use('/order', routerOrder);
app.use('/candle', routerCandle);
app.use('/contact', routerContact);
app.use('/live', routerLive);
app.use('/admin', routerAdmin);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Global error handler — never expose stack traces or internal messages in production
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  console.error(`[${new Date().toISOString()}] Unhandled error: ${err.message}`, isProd ? '' : err.stack);
  res.status(err.status || 500).json({
    error: isProd ? 'Internal server error' : err.message,
  });
});

app.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));
