import express from 'express';
import mongoose from 'mongoose';
import Order from '../../model/order.js';
import Candle from '../../model/candle.js';
import Contact from '../../model/contact.js';
import Review from '../../model/review.js';
import Payment from '../../model/payment.js';
import Prayer from '../../model/prayer.js';
import ProductReview from '../../model/productReview.js';
import { invalidateCatalog } from '../../services/catalog.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { audit, hashIp } from '../../services/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { isEmail } from '../../utils/validate.js';
import { adminErasureLimiter } from '../../utils/security.js';
import { opt, parseBody, str } from '../../utils/schema.js';

// Data-protection requests (GDPR / Israeli Privacy Protection Law), owner only. docs/DATABASE.md has the policy.
//
//   POST /admin/privacy/lookup { email, name?, country? }                  how many records of this person exist (counts only)
//   POST /admin/privacy/erase  { email, confirm: email, name?, country? }  erase them; the answer lists what was NOT erased
//
// What "erase" does, per collection:
//   order            ANONYMISED, not deleted: the sale must stay in the shop's accounts (tax records are kept for years);
//                    name, phone, address and e-mail are replaced, the products and the total stay.
//   candle           anonymised the same way (it is a paid service); the prayer text is replaced too.
//   contact message  deleted.   site review  deleted.
//   payment          the payer's e-mail and names are removed; the amount and PayPal id stay (accounts).
//   prayer           DELETED, but only when `name` AND `country` are given and both equal what was published (any case,
//                    nothing more or less): prayers keep no e-mail, and a name alone ("Maria") is shared by strangers.
//   product review   DELETED on the same rule (name AND country equal what was published). A review published without a
//                    country is not found this way: the owner deletes it from the Reviews page after checking it.
// Anything similar but not equal (another spelling, a nickname) is not touched: the owner removes it by hand from the
// Prayers or Product reviews page after checking it. The answer to erase says what was not searched and what lives
// outside the database (NOT_ERASED below), so the owner can finish by hand and tell the person.
//
// The e-mail address and the name are never put in the audit log (it would keep the personal data the request is about
// to remove for another 180 days): the entry holds a keyed hash that identifies "the same person" and the counts.

const router = express.Router();
router.use(requireRole('owner'), adminErasureLimiter);

export const ERASED_EMAIL = 'erased@erased.invalid';
const ERASED = 'Erased';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// What the person published under: the name of a prayer or a product review, and its country (both optional).
const PERSON = { name: opt(str({ min: 2, max: 200 })), country: opt(str({ min: 1, max: 100 })) };
const body = (raw) => parseBody(raw, { email: str({ min: 3, max: 254 }), confirm: str({ min: 3, max: 254 }), ...PERSON });
const lookupBody = (raw) => parseBody(raw, { email: str({ min: 3, max: 254 }), ...PERSON });

// Personal data this route can NOT erase, listed in every answer to erase (docs/DATABASE.md section 8 has the manual
// steps):
//   gmailSent   copies of the confirmation mails in the Gmail account's Sent folder (name, order or candle number)
//   backups     the database backups keep the old data until they are rotated out (at most 30 days, docs/BACKUP.md)
//   recordings  broadcast recordings at Cloudflare Stream are not linked to a person
//   paypal      PayPal's own record of the payment
//   hostLogs    request logs of Cloudflare, Render and Netlify (addresses, no names), kept by the providers
export const NOT_ERASED = Object.freeze(['gmailSent', 'backups', 'recordings', 'paypal', 'hostLogs']);

// The forms of a published text that count as "equal": as given, and with the five basic HTML entities decoded (the
// API stores visitor text HTML-escaped, & as &amp;; the text of this request arrives escaped the same way).
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const decodeEntities = (text) => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENTITIES[e]);
const exactly = (text) => {
  const forms = [...new Set([text, decodeEntities(text)])].map(escapeRegex);
  // Built from escaped text only, hence trusted: the published value must equal one of the forms, ignoring case.
  return mongoose.trusted({ $regex: `^(?:${forms.join('|')})$`, $options: 'i' });
};

/** Filters for the published records of this person; null for a kind the request does not identify well enough. */
function publishedFilters({ name, country }) {
  if (country && !name) throw new HttpError(400, 'A country is used only together with a name');
  return {
    prayers: name && country ? { name: exactly(name), country: exactly(country) } : null,
    productReviews: name && country ? { name: exactly(name), country: exactly(country) } : null,
  };
}

/** The kinds the request did not identify well enough to search (both need the name and the country). */
const notSearched = (published) => [
  ...(published.prayers ? [] : ['prayersNotSearched']),
  ...(published.productReviews ? [] : ['productReviewsNotSearched']),
];

// Orders, candles and payments store the address in lower case (schema `lowercase`); contact messages and site
// reviews were stored as typed, so those are matched without regard to case.
function filters(address) {
  const anyCase = { $regex: `^${escapeRegex(address)}$`, $options: 'i' };
  return {
    exact: { email: address },
    anyCase: { email: mongoose.trusted(anyCase) },
    payer: { $or: [{ payerEmail: address }, { 'fulfilment.email': address }] },
  };
}

function normalise(value) {
  const address = value.trim().toLowerCase();
  if (!isEmail(address)) throw new HttpError(400, 'Invalid email');
  if (address === ERASED_EMAIL) throw new HttpError(400, 'Invalid email'); // the placeholder that erased records carry
  return address;
}

async function count(address, published) {
  const f = filters(address);
  const [orders, candles, contacts, reviews, payments, prayers, productReviews] = await Promise.all([
    Order.countDocuments(f.exact),
    Candle.countDocuments(f.exact),
    Contact.countDocuments(f.anyCase),
    Review.countDocuments(f.anyCase),
    Payment.countDocuments(f.payer),
    published.prayers ? Prayer.countDocuments(published.prayers) : 0,
    published.productReviews ? ProductReview.countDocuments(published.productReviews) : 0,
  ]);
  return { orders, candles, contacts, reviews, payments, prayers, productReviews };
}

router.post('/lookup', asyncHandler(async (req, res) => {
  const input = lookupBody(req.body);
  const address = normalise(input.email);
  const published = publishedFilters(input);
  const found = await count(address, published);
  await audit(req, 'privacy.lookup', { type: 'privacy', id: hashIp(address) }, found);
  res.json({ found, notSearched: notSearched(published) });
}));

router.post('/erase', asyncHandler(async (req, res) => {
  const input = body(req.body);
  const address = normalise(input.email);
  if (normalise(input.confirm) !== address) throw new HttpError(400, 'The confirmation does not match the address');
  const published = publishedFilters(input);
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
    { $unset: { payerEmail: '', payerName: '', donorName: '', fulfilment: '' } },
  );
  const [prayers, productReviews] = await Promise.all([
    published.prayers ? Prayer.deleteMany(published.prayers) : null,
    published.productReviews ? ProductReview.deleteMany(published.productReviews) : null,
  ]);
  if (productReviews?.deletedCount) invalidateCatalog(); // the products' ratings change

  const erased = {
    orders: orders.modifiedCount ?? orders.matchedCount ?? 0,
    candles: candles.modifiedCount ?? candles.matchedCount ?? 0,
    contacts: contacts.deletedCount ?? 0,
    reviews: reviews.deletedCount ?? 0,
    payments: payments.modifiedCount ?? payments.matchedCount ?? 0,
    prayers: prayers?.deletedCount ?? 0,
    productReviews: productReviews?.deletedCount ?? 0,
  };
  await audit(req, 'privacy.erase', { type: 'privacy', id: hashIp(address) }, erased);
  res.json({ erased, notErased: [...notSearched(published), ...NOT_ERASED] });
}));

export default router;
