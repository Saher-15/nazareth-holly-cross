import express from 'express';
import mongoose from 'mongoose';
import Order from '../../model/order.js';
import Candle from '../../model/candle.js';
import Contact from '../../model/contact.js';
import Review from '../../model/review.js';
import Payment from '../../model/payment.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { audit, hashIp } from '../../services/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { isEmail } from '../../utils/validate.js';
import { adminErasureLimiter } from '../../utils/security.js';
import { parseBody, str } from '../../utils/schema.js';

// Data-protection requests (GDPR / Israeli Privacy Protection Law), owner only. docs/DATABASE.md has the policy.
//
//   POST /admin/privacy/lookup { email }                  how many records of this person exist (counts only)
//   POST /admin/privacy/erase  { email, confirm: email }  erase them
//
// What "erase" does, per collection:
//   order            ANONYMISED, not deleted: the sale must stay in the shop's accounts (tax records are kept for years);
//                    name, phone, address and e-mail are replaced, the products and the total stay.
//   candle           anonymised the same way (it is a paid service); the prayer text is replaced too.
//   contact message  deleted.   site review  deleted.
//   payment          the payer's e-mail and names are removed; the amount and PayPal id stay (accounts).
// Product reviews and prayers store no e-mail address, so they cannot be found by one and are not touched.
//
// The e-mail address is never put in the audit log (it would keep the personal data the request is about to remove
// for another 180 days): the entry holds a keyed hash that identifies "the same person" and the counts.

const router = express.Router();
router.use(requireRole('owner'), adminErasureLimiter);

export const ERASED_EMAIL = 'erased@erased.invalid';
const ERASED = 'Erased';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const body = (raw) => parseBody(raw, { email: str({ min: 3, max: 254 }), confirm: str({ min: 3, max: 254 }) });
const lookupBody = (raw) => parseBody(raw, { email: str({ min: 3, max: 254 }) });

// Orders, candles and payments store the address in lower case (schema `lowercase`); contact messages and site
// reviews were stored as typed, so those are matched without regard to case.
function filters(address) {
  const anyCase = { $regex: `^${escapeRegex(address)}$`, $options: 'i' };
  return {
    exact: { email: address },
    anyCase: { email: mongoose.trusted(anyCase) },
    payer: { payerEmail: address },
  };
}

function normalise(value) {
  const address = value.trim().toLowerCase();
  if (!isEmail(address)) throw new HttpError(400, 'Invalid email');
  if (address === ERASED_EMAIL) throw new HttpError(400, 'Invalid email'); // the placeholder that erased records carry
  return address;
}

async function count(address) {
  const f = filters(address);
  const [orders, candles, contacts, reviews, payments] = await Promise.all([
    Order.countDocuments(f.exact),
    Candle.countDocuments(f.exact),
    Contact.countDocuments(f.anyCase),
    Review.countDocuments(f.anyCase),
    Payment.countDocuments(f.payer),
  ]);
  return { orders, candles, contacts, reviews, payments };
}

router.post('/lookup', asyncHandler(async (req, res) => {
  const address = normalise(lookupBody(req.body).email);
  const found = await count(address);
  await audit(req, 'privacy.lookup', { type: 'privacy', id: hashIp(address) }, found);
  res.json({ found });
}));

router.post('/erase', asyncHandler(async (req, res) => {
  const input = body(req.body);
  const address = normalise(input.email);
  if (normalise(input.confirm) !== address) throw new HttpError(400, 'The confirmation does not match the address');
  const f = filters(address);
  const erasedAt = new Date();

  // The ids first: payments of an order are found through the order, and the e-mail is about to disappear from it.
  const [orderIds, candleIds] = await Promise.all([
    Order.find(f.exact).select('_id').lean(),
    Candle.find(f.exact).select('_id').lean(),
  ]);
  const linked = [...orderIds, ...candleIds].map((d) => d._id);

  const person = { firstName: ERASED, lastName: ERASED, email: ERASED_EMAIL, erasedAt };
  const [orders, candles, contacts, reviews] = await Promise.all([
    Order.updateMany(f.exact, { $set: { ...person, phone: ERASED, street: ERASED, city: ERASED, state: ERASED, postal: ERASED, country: ERASED } }),
    Candle.updateMany(f.exact, { $set: { ...person, prayer: ERASED } }),
    Contact.deleteMany(f.anyCase),
    Review.deleteMany(f.anyCase),
  ]);
  const payments = await Payment.updateMany(
    { $or: [f.payer, ...(linked.length ? [{ 'linkedTo.id': mongoose.trusted({ $in: linked }) }] : [])] },
    { $unset: { payerEmail: '', payerName: '', donorName: '' } },
  );

  const erased = {
    orders: orders.modifiedCount ?? orders.matchedCount ?? 0,
    candles: candles.modifiedCount ?? candles.matchedCount ?? 0,
    contacts: contacts.deletedCount ?? 0,
    reviews: reviews.deletedCount ?? 0,
    payments: payments.modifiedCount ?? payments.matchedCount ?? 0,
  };
  await audit(req, 'privacy.erase', { type: 'privacy', id: hashIp(address) }, erased);
  res.json({ erased });
}));

export default router;
