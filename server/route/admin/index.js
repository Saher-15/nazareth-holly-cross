import express from 'express';
import authRouter from './auth.js';
import ordersRouter from './orders.js';
import productsRouter from './products.js';
import usersRouter from './users.js';
import auditRouter from './audit.js';
import exportRouter from './export.js';
import paymentsRouter from './payments.js';
import privacyRouter from './privacy.js';
import settingsRouter from './settings.js';
import liveRouter from './live.js';
import { candles, contacts, siteReviews, productReviews, prayers } from './collections.js';
import { adminAccess, requireRole } from '../../middleware/adminGuard.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { getDashboard } from '../../services/dashboard.js';

// The admin dashboard API (docs/ADMIN.md), mounted at /admin. It is the only way into private data: the legacy admin
// router, its sign-ins and its 8-hour tokens were removed on 2026-10-07 (docs/ADMIN.md section 7).
//
// Every route below is behind adminAccess (Bearer token + live session + per-admin rate limit) and a role check:
//   viewer  GET lists and details         editor  change and delete, export
//   owner   users, audit log, delete orders
//   editor  also: live broadcasting (start / stop / state), route/admin/live.js
// The only public routes are POST /admin/auth/login, /admin/auth/forgot-password and /admin/auth/reset-password.

const router = express.Router();

// Private data never goes into a cache, on any path of this router (errors and 404s included).
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.use('/auth', authRouter);

router.get('/dashboard', ...adminAccess, requireRole('viewer'), asyncHandler(async (req, res) => {
  res.json(await getDashboard());
}));

router.use('/orders', ...adminAccess, ordersRouter);
router.use('/candles', ...adminAccess, candles);
router.use('/contacts', ...adminAccess, contacts);
router.use('/site-reviews', ...adminAccess, siteReviews);
router.use('/product-reviews', ...adminAccess, productReviews);
router.use('/prayers', ...adminAccess, prayers);
router.use('/products', ...adminAccess, productsRouter);
router.use('/payments', ...adminAccess, paymentsRouter);
router.use('/export', ...adminAccess, exportRouter);
router.use('/live', ...adminAccess, liveRouter); // editor or owner (route/admin/live.js)
router.use('/users', ...adminAccess, requireRole('owner'), usersRouter);
router.use('/audit', ...adminAccess, requireRole('owner'), auditRouter);
router.use('/privacy', ...adminAccess, requireRole('owner'), privacyRouter);
router.use('/settings', ...adminAccess, settingsRouter); // read: every admin; candle price: owner (route/admin/settings.js)

export default router;
