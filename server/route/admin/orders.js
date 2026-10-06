import express from 'express';
import mongoose from 'mongoose';
import Order from '../../model/order.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { sendMail } from '../../services/emailService.js';
import { audit } from '../../services/audit.js';
import { parseBody, bool } from '../../utils/schema.js';
import { found, listHandler, objectId } from './common.js';

const router = express.Router();

export const ORDER_LIST = {
  searchFields: ['firstName', 'lastName', 'email', 'phone', 'city', 'country', 'paypalOrderId'],
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
        subject: 'Your order was shipped',
        text: `Your order number ${order._id} was shipped :)`,
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
