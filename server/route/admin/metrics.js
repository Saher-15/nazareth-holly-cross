import express from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { FLOWS, funnelReport, reportRange } from '../../services/metrics.js';
import { HttpError } from '../../utils/httpError.js';

// GET /admin/metrics/funnel?flow=candle&from=YYYY-MM-DD&to=YYYY-MM-DD (docs/ANALYTICS.md): the sales funnel of one
// flow, in total, per campaign and per day. Every admin may read it (it holds counts only, nothing personal).
// Defaults: the candle flow, the last 30 days; a range is at most 366 days.
const router = express.Router();

router.get('/funnel', requireRole('viewer'), asyncHandler(async (req, res) => {
  const flow = req.query.flow === undefined ? 'candle' : req.query.flow;
  if (typeof flow !== 'string' || !FLOWS.includes(flow)) throw new HttpError(400, 'Unknown flow');
  const range = reportRange({ from: req.query.from, to: req.query.to });
  res.json(await funnelReport({ ...range, flow }));
}));

export default router;
