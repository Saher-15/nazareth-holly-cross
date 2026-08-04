import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import { xss } from 'express-xss-sanitizer';
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(xss());
app.use(globalLimiter);

app.use('/auth', routerAuth);
app.use('/product', routerProduct);
app.use('/order', routerOrder);
app.use('/candle', routerCandle);
app.use('/contact', routerContact);
app.use('/live', routerLive);
app.use('/admin', routerAdmin);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));
