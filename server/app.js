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
  // Local development origins are not trusted in production (a page on a visitor's own machine could
  // otherwise call the live API with their credentials); use EXTRA_ORIGINS to allow one deliberately.
  const allowedOrigins = [
    ...(config.isProd ? [] : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174']),
    'https://nazarethholycross.com',
    'https://www.nazarethholycross.com',
    // the public site and the admin site on Netlify, including deploy previews
    /^https:\/\/([a-z0-9-]+--)?(nazarethholycross|nazaretholycrossadmin)\.netlify\.app$/,
    config.clientUrl,
    ...config.extraOrigins,
  ].filter(Boolean);

  // This is a JSON API: it never serves pages, so the browser is told to load nothing from it and to
  // never frame it. (Helmet's other defaults - nosniff, hidden X-Powered-By, CORP - stay on.)
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
  }));
  app.use(cors({
    maxAge: 600, // browsers may cache the preflight answer for ten minutes
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
  // Strip MongoDB operators ($where, $gt, ...) and dotted keys from req.body/params/query/headers. Must run
  // BEFORE xss(): express-xss-sanitizer 2.x makes req.query read-only, and this one assigns to it.
  app.use(mongoSanitize());
  app.use(xss()); // strips HTML tags from every string (and escapes & < >; see web/src/lib/plainText.ts)
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
