import express from 'express';
import Prayer from '../model/prayer.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { likeLimiter, strictLimiter } from '../utils/security.js';
import { isObjectId, isText } from '../utils/validate.js';

const routerPrayer = express.Router();

routerPrayer.get('/getPrayers', asyncHandler(async (req, res) => {
  // Query values are text, but ?page[]=1 or ?category[x]=y make them arrays or objects: the category is
  // used only when it is plain text (an operator object can never reach the query), and page and size
  // are always whole numbers within bounds.
  const page = Math.min(10000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const size = Math.min(50, Math.max(1, parseInt(req.query.size, 10) || 20));
  const category = req.query.category;
  const filter = typeof category === 'string' && category !== 'All' && category !== '' ? { category } : {};
  const prayers = await Prayer.find(filter).sort({ createdAt: -1 }).limit(size).skip((page - 1) * size);
  const total = await Prayer.countDocuments(filter);
  res.json({ prayers, total, page, size });
}));

routerPrayer.post('/create', strictLimiter, asyncHandler(async (req, res) => {
  const { name, country, prayer, category } = req.body ?? {};
  if (!isText(name) || !isText(prayer)) return res.status(400).json({ error: 'Name and prayer are required' });
  // Only the four public fields are taken from the body (likes, createdAt, ... can never be set by a visitor).
  // A wrong type for country or category fails the model's validation (400).
  const newPrayer = new Prayer({ name, country, prayer, category });
  await newPrayer.save();
  res.status(201).json(newPrayer);
}));

routerPrayer.post('/like/:id', likeLimiter, asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const p = await Prayer.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
  if (!p) return res.status(404).json({ error: 'Prayer not found' });
  res.json({ likes: p.likes });
}));

routerPrayer.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await Prayer.findByIdAndDelete(req.params.id);
  res.json({ message: 'Prayer deleted' });
}));

export default routerPrayer;
