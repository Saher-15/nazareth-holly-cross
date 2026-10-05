import express from 'express';
import Candle from '../../model/candle.js';
import Contact from '../../model/contact.js';
import Review from '../../model/review.js';
import ProductReview from '../../model/productReview.js';
import Prayer from '../../model/prayer.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { invalidateCatalog } from '../../services/catalog.js';
import { audit } from '../../services/audit.js';
import { bool, parseBody } from '../../utils/schema.js';
import { found, listHandler, objectId } from './common.js';

// The collections an editor works through: visitors' candle requests, contact messages, reviews of the website,
// reviews of products and the prayer wall. All have the same shape:
//
//   GET    /          paginated list (viewer)      ?page &size &q &status &sort
//   PATCH  /:id       { done } or { approved }     (editor; not for prayers)
//   DELETE /:id       (editor)
//
// Every change is written to the audit log.

function collection({ Model, type, flag, listOptions, queryOptions, after = () => {} }) {
  const router = express.Router();
  router.get('/', requireRole('viewer'), listHandler(Model, listOptions, queryOptions));

  if (flag) {
    router.patch('/:id', requireRole('editor'), asyncHandler(async (req, res) => {
      const id = objectId(req.params.id);
      const body = parseBody(req.body, { [flag]: bool() });
      const item = found(await Model.findByIdAndUpdate(id, { $set: { [flag]: body[flag] } }, { new: true }).lean(), type);
      after();
      await audit(req, `${type}.update`, { type, id }, { [flag]: body[flag] });
      res.json({ item });
    }));
  }

  router.delete('/:id', requireRole('editor'), asyncHandler(async (req, res) => {
    const id = objectId(req.params.id);
    found(await Model.findByIdAndDelete(id), type);
    after();
    await audit(req, `${type}.delete`, { type, id });
    res.json({ message: 'Deleted' });
  }));

  return router;
}

const pending = { done: false };
const finished = { done: true };

export const candles = collection({
  Model: Candle,
  type: 'candle',
  flag: 'done',
  listOptions: {
    searchFields: ['firstName', 'lastName', 'email', 'prayer'],
    statuses: { pending, done: finished },
    sorts: { createdAt: true, lastName: true },
  },
});

export const contacts = collection({
  Model: Contact,
  type: 'contact',
  flag: 'done',
  listOptions: {
    searchFields: ['fullName', 'email', 'phone', 'msg'],
    statuses: { open: pending, done: finished },
    sorts: { createdAt: true, fullName: true },
  },
});

// Reviews of the website itself (the public "Reviews" page). `approved: false` hides one without deleting it.
export const siteReviews = collection({
  Model: Review,
  type: 'site-review',
  flag: 'approved',
  listOptions: {
    searchFields: ['fullName', 'email', 'msg'],
    statuses: { approved: { approved: true }, hidden: { approved: false } },
    sorts: { createdAt: true, fullName: true },
  },
});

// Reviews of products. The storefront catalogue caches the ratings, so every change refreshes it.
export const productReviews = collection({
  Model: ProductReview,
  type: 'product-review',
  flag: 'approved',
  listOptions: {
    searchFields: ['name', 'country', 'title', 'comment'],
    statuses: { approved: { approved: true }, hidden: { approved: false } },
    sorts: { createdAt: true, rating: true },
  },
  queryOptions: { populate: { path: 'product', select: 'name' } },
  after: invalidateCatalog,
});

// The prayer wall. `status` filters by category. Prayers are deleted, not hidden.
export const prayers = collection({
  Model: Prayer,
  type: 'prayer',
  listOptions: {
    searchFields: ['name', 'country', 'prayer'],
    statuses: Object.fromEntries((Prayer.schema?.path('category')?.enumValues ?? []).map((c) => [c, { category: c }])),
    sorts: { createdAt: true, likes: true },
  },
});
