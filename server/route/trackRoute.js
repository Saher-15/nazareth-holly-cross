import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { looksAutomated, recordEvent } from '../services/metrics.js';
import { trackLimiter } from '../utils/security.js';

// POST /track { flow, event, source?, medium?, campaign? }: one step of the sales funnel happened (services/metrics.js).
// Always answers 204 with no body, whatever was sent: the page never waits for it and learns nothing from it. Nothing
// about the visitor is read except the User-Agent, and that only to leave crawlers and monitors out of the counts; it
// is not stored. A failure to count is logged and never becomes an error for the visitor.
const routerTrack = express.Router();

routerTrack.post('/', trackLimiter, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!looksAutomated(req.get('user-agent'))) {
    try {
      await recordEvent(req.body ?? {});
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [metrics] an event was not counted: ${error.message}`);
    }
  }
  res.status(204).end();
}));

export default routerTrack;
