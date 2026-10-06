import express from 'express';
import mongoose from 'mongoose';
import Payment from '../../model/payment.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { audit } from '../../services/audit.js';
import { unfulfilledFilter } from '../../services/payments.js';
import { HttpError } from '../../utils/httpError.js';
import { bool, opt, parseBody, str } from '../../utils/schema.js';
import { found, listHandler, objectId } from './common.js';

// The payment ledger (model/payment.js, docs/ADMIN.md "Payments"):
//
//   GET   /          paginated list (viewer)    ?page &size &q &status &sort
//   GET   /:id       one payment (viewer)
//   PATCH /:id       { resolved, note }  (editor)  an admin dealt with a payment that has no order or candle
//
// There is deliberately NO delete: the ledger is the shop's record that money moved, and nothing in it is removed
// through the API. A payment is only ever marked resolved (and can be reopened).

const router = express.Router();

export const PAYMENT_LIST = {
  searchFields: ['paypalOrderId', 'payerEmail', 'payerName', 'donorName', 'notes'],
  statuses: {
    // Paid, but no saved order or candle request points to it. A getter: the grace period is measured from NOW.
    get unfulfilled() { return unfulfilledFilter(); },
    captured: { status: 'captured' },
    created: { status: 'created' }, // started, never captured (abandoned, or the capture answer never arrived)
    failed: { status: 'failed' },
    resolved: { resolvedAt: mongoose.trusted({ $ne: null }) },
    order: { type: 'order' },
    candle: { type: 'candle' },
    donation: { type: 'donation' },
  },
  sorts: { createdAt: true, capturedAt: true, amount: true, status: true },
};

router.get('/', requireRole('viewer'), listHandler(Payment, PAYMENT_LIST));

router.get('/:id', requireRole('viewer'), asyncHandler(async (req, res) => {
  res.json(found(await Payment.findById(objectId(req.params.id)).lean(), 'Payment'));
}));

// PATCH /admin/payments/:id { resolved: true, note: "refunded by hand" } | { resolved: false }
router.patch('/:id', requireRole('editor'), asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const body = parseBody(req.body, { resolved: bool(), note: opt(str({ min: 1, max: 1000, multiline: true })) });
  if (body.resolved && !body.note) throw new HttpError(400, 'note is required when resolving a payment');

  const current = found(await Payment.findById(id).lean(), 'Payment');
  if (body.resolved && current.linkedTo?.id) throw new HttpError(409, 'This payment is already linked to an order or candle request');

  const change = body.resolved
    ? { resolvedAt: new Date(), resolvedBy: req.adminUser.username, notes: body.note }
    : { resolvedAt: null, ...(body.note ? { notes: body.note } : {}) };
  const item = found(await Payment.findByIdAndUpdate(id, { $set: change }, { new: true, runValidators: true }).lean(), 'Payment');
  await audit(req, 'payment.update', { type: 'payment', id }, { resolved: body.resolved, paypalOrderId: current.paypalOrderId });
  res.json({ item });
}));

export default router;
