import express from 'express';
import mongoose from 'mongoose';
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
import routerAdminApi from './route/admin/index.js';
import routerPrayer from './route/prayerRoute.js';
import routerReview from './route/reviewRoute.js';
import { apiLimiter, healthLimiter, publicReadCache } from './utils/security.js';
import { deepHealth } from './services/health.js';
import { config } from './config/env.js';
import { HttpError } from './utils/httpError.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// The public site's own addresses: the domain, www, and Netlify's production address of the site (it answers with a
// 301 to the domain, but is still this site's own origin).
export const PRODUCTION_ORIGINS = Object.freeze([
  'https://nazarethholycross.com',
  'https://www.nazarethholycross.com',
  'https://nazarethholycross.netlify.app',
]);
// Netlify's deploy previews of THIS site (one per pull request): exactly `deploy-preview-<number>--nazarethholycross`.
// Branch deploys and any other `<anything>--nazarethholycross` subdomain are not trusted (the repository is public:
// such a subdomain can carry code nobody reviewed), nor is the retired 2024 admin site `nazaretholycrossadmin`.
// The dashboard calls the API from its own server (no CORS); a browser origin for it goes in ADMIN_ORIGINS.
export const DEPLOY_PREVIEW_ORIGIN = /^https:\/\/deploy-preview-\d{1,6}--nazarethholycross\.netlify\.app$/;

// Builds the Express app without connecting to the DB or listening,
// so tests can import it and drive it with supertest.
export function createApp() {
  const app = express();
  // How many proxies sit in front of this process (TRUST_PROXY_HOPS, default 1); it decides which address the
  // per-IP rate limits count. See config/env.js and docs/INFRASTRUCTURE.md.
  app.set('trust proxy', config.trustProxyHops);

  if (!config.isProd) {
    app.use(morgan('dev'));
  }

  // Only our own sites may call the API from a browser (any *.netlify.app used to be allowed).
  // Local development origins are not trusted in production (a page on a visitor's own machine could
  // otherwise call the live API with their credentials); use EXTRA_ORIGINS to allow one deliberately.
  const allowedOrigins = [
    ...(config.isProd ? [] : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174']),
    ...PRODUCTION_ORIGINS,
    DEPLOY_PREVIEW_ORIGIN,
    config.clientUrl,
    ...config.extraOrigins,
    ...config.adminOrigins, // the new admin dashboard (ADMIN_ORIGINS, docs/ADMIN.md)
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
  // xss() strips HTML tags from every string (and escapes & < >; see web/src/lib/plainText.ts). It is skipped for the
  // admin sign-in, password and user-creation bodies: a password containing & < > would otherwise reach the code as
  // HTML entities, and the hash made from it would never match what the person types. Those fields are never
  // rendered as HTML, and usernames are restricted to letters, digits and . _ - by the route.
  const sanitize = xss();
  const RAW_BODY = /^\/admin\/(auth\/|users\/?$)/;
  app.use((req, res, next) => (RAW_BODY.test(req.path) ? next() : sanitize(req, res, next)));
  // Health checks come before the general limiter: a monitor must never be refused because other visitors used up
  // the shared allowance. /health only says the process answers; /health/deep also pings the database (503 when it
  // cannot be reached) and reports uptime, version and PayPal mode, never a secret (services/health.js).
  app.get('/health', healthLimiter, (req, res) =>
    res.json({
      status: 'ok',
      database: mongoose.connection.readyState === 1 ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    }),
  );
  app.get('/health/deep', healthLimiter, async (req, res, next) => {
    try {
      const { healthy, body } = await deepHealth();
      res.set('Cache-Control', 'no-store').status(healthy ? 200 : 503).json(body);
    } catch (err) {
      next(err);
    }
  });

  app.use(publicReadCache);
  app.use(apiLimiter);

  // The public routes below take no token at all. Every private read or change is under /admin (the dashboard API,
  // route/admin/index.js: a live session, a role check, the audit log). The legacy sign-ins (/auth/login,
  // /admin/login) and the legacy admin routes that accepted their 8-hour tokens were removed on 2026-10-07.
  app.use('/product', routerProduct);
  app.use('/order', routerOrder);
  app.use('/candle', routerCandle);
  app.use('/contact', routerContact);
  app.use('/live', routerLive);
  app.use('/admin', routerAdminApi);
  app.use('/prayer', routerPrayer);
  app.use('/review', routerReview);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
