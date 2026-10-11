import express from 'express';
import mongoose from 'mongoose';
import Product from '../../model/product.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { CATEGORIES, invalidateCatalog } from '../../services/catalog.js';
import { audit } from '../../services/audit.js';
import { refreshSite } from '../../services/siteRefresh.js';
import { config } from '../../config/env.js';
import { HttpError } from '../../utils/httpError.js';
import { arrayOf, int, nullable, num, oneOf, opt, parseBody, str, url } from '../../utils/schema.js';
import { found, listHandler, objectId } from './common.js';

const router = express.Router();

// Product fields the admin may set. Anything else in a body is refused (no mass assignment: _id, createdAt, ...).
//   rate      the featuring weight 0-5 the storefront ranks by (not a star rating)
//   stock     whole units; null = not tracked
//   category  an override of the category inferred from the name; null = infer
//   price     US dollars and cents: 0.01 to 10,000, at most two decimals (a typed "24,50" read as 2450 is caught by the
//             dashboard; a price with more decimals is refused here)
export const PRODUCT_FIELDS = {
  name: str({ min: 2, max: 200 }),
  price: (value, field) => {
    const price = num({ min: 0.01, max: 10_000 })(value, field);
    if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) throw new HttpError(400, `Invalid ${field}: at most two decimals`);
    return price;
  },
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

// A photo must be on a host the website can show (config.productImageHosts, the same list as the site's next/image
// remotePatterns and CSP img-src): any other https address would be saved and then appear as a broken image in the shop.
// Outside production a local address (http://localhost, 127.0.0.1) is accepted too, for the harness and development.
const LOCAL = new Set(['localhost', '127.0.0.1']);
export function imageHostAllowed(address) {
  try {
    const url = new URL(address);
    if (url.protocol === 'https:' && config.productImageHosts.includes(url.hostname.toLowerCase())) return true;
    return (!config.isProd || config.productImageLocal) && LOCAL.has(url.hostname) && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

/** New photo addresses only: one already saved on the product stays editable around it (an older product). */
function checkImageHosts(fields, before = null) {
  const hosts = config.productImageHosts.join(', ');
  if (fields.img !== undefined && fields.img !== before?.img && !imageHostAllowed(fields.img)) {
    throw new HttpError(400, `Invalid img: the website shows photos only from ${hosts}`);
  }
  const known = new Set(before?.additionalImageUrls ?? []);
  if ((fields.additionalImageUrls ?? []).some((u) => !known.has(u) && !imageHostAllowed(u))) {
    throw new HttpError(400, `Invalid additionalImageUrls: the website shows photos only from ${hosts}`);
  }
}

const createShape = Object.fromEntries(Object.entries(PRODUCT_FIELDS).map(([k, rule]) => [k, REQUIRED_ON_CREATE.includes(k) ? rule : opt(rule)]));
const updateShape = Object.fromEntries(Object.entries(PRODUCT_FIELDS).map(([k, rule]) => [k, opt(rule)]));

router.get('/', requireRole('viewer'), listHandler(Product, {
  searchFields: ['name', 'description', 'uuidv4_'],
  statuses: {
    ok: { $or: [{ stock: null }, { stock: mongoose.trusted({ $gt: 5 }) }] }, // not tracked, or more than 5 left
    low: { stock: mongoose.trusted({ $lte: 5 }) }, // tracked and at or below 5 (untracked stock is null: never matches)
    out: { stock: 0 },
  },
  sorts: { createdAt: true, name: true, price: true, stock: true, rate: true },
}));

router.get('/:id', requireRole('viewer'), asyncHandler(async (req, res) => {
  res.json(found(await Product.findById(objectId(req.params.id)).lean(), 'Product'));
}));

// Every change answers `siteRefresh` too: whether the website was asked to show it at once (services/siteRefresh.js).
router.post('/', requireRole('editor'), asyncHandler(async (req, res) => {
  const fields = parseBody(req.body, createShape);
  checkImageHosts(fields);
  const product = await Product.create(fields);
  invalidateCatalog();
  await audit(req, 'product.create', { type: 'product', id: product._id }, { name: fields.name });
  const siteRefresh = await refreshSite([product._id]);
  res.status(201).json({ item: product, siteRefresh });
}));

const update = asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const fields = parseBody(req.body, updateShape);
  if (Object.keys(fields).length === 0) throw new HttpError(400, 'No fields to update');
  if (fields.img !== undefined || fields.additionalImageUrls !== undefined) {
    checkImageHosts(fields, found(await Product.findById(id).select('img additionalImageUrls').lean(), 'Product'));
  }
  const item = found(await Product.findByIdAndUpdate(id, { $set: fields }, { new: true, runValidators: true }).lean(), 'Product');
  invalidateCatalog();
  await audit(req, 'product.update', { type: 'product', id }, { fields: Object.keys(fields) });
  const siteRefresh = await refreshSite([id]);
  res.json({ item, siteRefresh });
});
router.patch('/:id', requireRole('editor'), update);
router.put('/:id', requireRole('editor'), update);

router.delete('/:id', requireRole('editor'), asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const product = found(await Product.findByIdAndDelete(id), 'Product');
  invalidateCatalog();
  await audit(req, 'product.delete', { type: 'product', id }, { name: product.name });
  const siteRefresh = await refreshSite([id]);
  res.json({ message: 'Product deleted', siteRefresh });
}));

export default router;
