import express from 'express';
import authRouter from './auth.js';
import ordersRouter from './orders.js';
import productsRouter from './products.js';
import usersRouter from './users.js';
import auditRouter from './audit.js';
import exportRouter from './export.js';
import paymentsRouter from './payments.js';
import privacyRouter from './privacy.js';
import { candles, contacts, siteReviews, productReviews, prayers } from './collections.js';
import { adminAccess, requireRole } from '../../middleware/adminGuard.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { getDashboard } from '../../services/dashboard.js';

// The admin dashboard API (docs/ADMIN.md). Mounted at /admin BEFORE the legacy admin router (route/adminRoute.js),
// which keeps serving the old admin site: where an address exists in both, a legacy token is handed on to the
// legacy route (middleware/adminGuard.js) and a dashboard token is served here.
//
// Every route below is behind adminAccess (Bearer token + live session + per-admin rate limit) and a role check:
//   viewer  GET lists and details         editor  change and delete, export
//   owner   users, audit log, delete orders
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
router.use('/users', ...adminAccess, requireRole('owner'), usersRouter);
router.use('/audit', ...adminAccess, requireRole('owner'), auditRouter);
router.use('/privacy', ...adminAccess, requireRole('owner'), privacyRouter);

export default router;
