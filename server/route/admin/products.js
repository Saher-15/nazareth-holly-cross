import express from 'express';
import mongoose from 'mongoose';
import Product from '../../model/product.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { CATEGORIES, invalidateCatalog } from '../../services/catalog.js';
import { audit } from '../../services/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { arrayOf, int, nullable, num, oneOf, opt, parseBody, str, url } from '../../utils/schema.js';
import { found, listHandler, objectId } from './common.js';

const router = express.Router();

// Product fields the admin may set. Anything else in a body is refused (no mass assignment: _id, createdAt, ...).
//   rate      the featuring weight 0-5 the storefront ranks by (not a star rating)
//   stock     whole units; null = not tracked
//   category  an override of the category inferred from the name; null = infer
export const PRODUCT_FIELDS = {
  name: str({ min: 2, max: 200 }),
  price: num({ min: 0.01, max: 10_000 }),
  img: url(),
  additionalImageUrls: arrayOf(url(), { max: 20 }),
  description: str({ min: 0, max: 2000, multiline: true }),
  uuidv4_: str({ min: 1, max: 64 }),
  rate: num({ min: 0, max: 5 }),
  color: arrayOf(str({ min: 1, max: 50 }), { max: 20 }),
  stock: nullable(int({ min: 0, max: 1_000_000 })),
  category: nullable(oneOf(CATEGORIES)),
};
const REQUIRED_ON_CREATE = ['name', 'price', 'img'];

const createShape = Object.fromEntries(Object.entries(PRODUCT_FIELDS).map(([k, rule]) => [k, REQUIRED_ON_CREATE.includes(k) ? rule : opt(rule)]));
const updateShape = Object.fromEntries(Object.entries(PRODUCT_FIELDS).map(([k, rule]) => [k, opt(rule)]));

router.get('/', requireRole('viewer'), listHandler(Product, {
  searchFields: ['name', 'description', 'uuidv4_'],
  statuses: {
    low: { stock: mongoose.trusted({ $lte: 5 }) }, // tracked and at or below 5 (untracked stock is null: never matches)
    out: { stock: 0 },
  },
  sorts: { createdAt: true, name: true, price: true, stock: true, rate: true },
}));

router.get('/:id', requireRole('viewer'), asyncHandler(async (req, res) => {
  res.json(found(await Product.findById(objectId(req.params.id)).lean(), 'Product'));
}));

router.post('/', requireRole('editor'), asyncHandler(async (req, res) => {
  const fields = parseBody(req.body, createShape);
  const product = await Product.create(fields);
  invalidateCatalog();
  await audit(req, 'product.create', { type: 'product', id: product._id }, { name: fields.name });
  res.status(201).json({ item: product });
}));

const update = asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const fields = parseBody(req.body, updateShape);
  if (Object.keys(fields).length === 0) throw new HttpError(400, 'No fields to update');
  const item = found(await Product.findByIdAndUpdate(id, { $set: fields }, { new: true, runValidators: true }).lean(), 'Product');
  invalidateCatalog();
  await audit(req, 'product.update', { type: 'product', id }, { fields: Object.keys(fields) });
  res.json({ item });
});
router.patch('/:id', requireRole('editor'), update);
router.put('/:id', requireRole('editor'), update);

router.delete('/:id', requireRole('editor'), asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const product = found(await Product.findByIdAndDelete(id), 'Product');
  invalidateCatalog();
  await audit(req, 'product.delete', { type: 'product', id }, { name: product.name });
  res.json({ message: 'Product deleted' });
}));

export default router;
