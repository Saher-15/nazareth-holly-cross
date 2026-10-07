import express from 'express';
import mongoose from 'mongoose';
import Order from '../../model/order.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { sendMail } from '../../services/emailService.js';
import { audit } from '../../services/audit.js';
import { orderNumber } from '../../utils/orderNumber.js';
import { parseBody, bool } from '../../utils/schema.js';
import { found, listHandler, objectId } from './common.js';

const router = express.Router();

// The order number (utils/orderNumber.js). Searching for it, with or without '#', or for any 6 to 24 last characters
// of the id, finds the order (an $expr over the id as text: orders are few, and the id cannot be searched otherwise).
const ORDER_NUMBER = /^#?\s*([a-f0-9]{6,24})$/i;
export function orderNumberClause(q) {
  const match = ORDER_NUMBER.exec(String(q ?? '').trim());
  if (!match) return null;
  return { $expr: mongoose.trusted({ $regexMatch: { input: { $toString: '$_id' }, regex: `${match[1].toLowerCase()}$`, options: 'i' } }) };
}

export const ORDER_LIST = {
  searchFields: ['firstName', 'lastName', 'email', 'phone', 'city', 'country', 'paypalOrderId'],
  searchExtra: orderNumberClause,
  statuses: {
    pending: { done: false },
    shipped: { done: true },
    unverified: { paymentVerified: mongoose.trusted({ $ne: true }) }, // saved without a PayPal-confirmed payment
  },
  sorts: { createdAt: true, totalPrice: true, lastName: true },
};

router.get('/', requireRole('viewer'), listHandler(Order, ORDER_LIST));

router.get('/:id', requireRole('viewer'), asyncHandler(async (req, res) => {
  res.json(found(await Order.findById(objectId(req.params.id)).lean(), 'Order'));
}));

// PATCH /admin/orders/:id { done }: marks the order shipped (or not). Like POST /order/orderSent, the transition to
// "shipped" e-mails the customer - once: marking an already shipped order again sends nothing. The change is kept
// even if the mail cannot be sent; the answer then says emailSent: false so the admin can write to the customer.
router.patch('/:id', requireRole('editor'), asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const { done } = parseBody(req.body, { done: bool() });

  let order;
  let emailSent = null; // null = no mail was due
  if (done) {
    order = await Order.findOneAndUpdate({ _id: id, done: mongoose.trusted({ $ne: true }) }, { $set: { done: true } }, { new: true }).lean();
    if (order) {
      emailSent = await sendMail({
        to: [order.email],
        subject: `Your order ${orderNumber(order._id)} was shipped`,
        text: `Your order ${orderNumber(order._id)} was shipped :) (reference ${order._id})`,
      });
    } else {
      order = found(await Order.findById(id).lean(), 'Order'); // already shipped, or missing
    }
  } else {
    order = found(await Order.findByIdAndUpdate(id, { $set: { done: false } }, { new: true }).lean(), 'Order');
  }
  await audit(req, 'order.update', { type: 'order', id }, { done, emailSent });
  res.json({ item: order, emailSent });
}));

router.delete('/:id', requireRole('owner'), asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  found(await Order.findByIdAndDelete(id), 'Order');
  await audit(req, 'order.delete', { type: 'order', id });
  res.json({ message: 'Order deleted' });
}));

export default router;
