import express from 'express';
import cors from 'cors';
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
import routerPrayer from './route/prayerRoute.js';
import routerReview from './route/reviewRoute.js';
import { globalLimiter } from './utils/security.js';
import { config } from './config/env.js';
import { HttpError } from './utils/httpError.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Builds the Express app without connecting to the DB or listening,
// so tests can import it and drive it with supertest.
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  if (!config.isProd) {
    app.use(morgan('dev'));
  }

  // Only our own sites may call the API from a browser (any *.netlify.app used to be allowed).
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://nazarethholycross.com',
    'https://www.nazarethholycross.com',
    // the public site and the admin site on Netlify, including deploy previews
    /^https:\/\/([a-z0-9-]+--)?(nazarethholycross|nazaretholycrossadmin)\.netlify\.app$/,
    config.clientUrl,
    ...config.extraOrigins,
  ].filter(Boolean);

  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = allowedOrigins.some(o =>
        o instanceof RegExp ? o.test(origin) : o === origin
      );
      if (allowed) return cb(null, true);
      cb(new HttpError(403, 'Not allowed by CORS'));
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
  app.use('/prayer', routerPrayer);
  app.use('/review', routerReview);

  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
