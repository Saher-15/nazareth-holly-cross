import express from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { audit } from '../../services/audit.js';
import { CANDLE_PRICE_MAX, CANDLE_PRICE_MIN, getSettings, setCandlePrice } from '../../services/siteSettings.js';
import { num, parseBody } from '../../utils/schema.js';

// /admin/settings (docs/ADMIN.md, "Settings"): every admin reads them, only an owner changes the candle price
// (it is what customers are charged). Each change is in the audit log with the old and the new value.
const router = express.Router();

const view = (settings) => ({
  candlePrice: settings.candlePrice,
  candlePriceMin: CANDLE_PRICE_MIN,
  candlePriceMax: CANDLE_PRICE_MAX,
  currency: 'USD',
  updatedAt: settings.updatedAt,
  updatedBy: settings.updatedBy,
});

router.get('/', requireRole('viewer'), asyncHandler(async (req, res) => {
  res.json(view(await getSettings()));
}));

router.put('/candle-price', requireRole('owner'), asyncHandler(async (req, res) => {
  const { price } = parseBody(req.body, { price: num({ min: CANDLE_PRICE_MIN, max: CANDLE_PRICE_MAX }) });
  const change = await setCandlePrice(price, { id: req.adminUser.id, name: req.adminUser.username });
  await audit(req, 'settings.candle_price', { type: 'siteSetting', id: 'site' }, change);
  res.json(view(await getSettings()));
}));

export default router;
