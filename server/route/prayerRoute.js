import express from 'express';
import Prayer from '../model/prayer.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { strictLimiter } from '../utils/security.js';

const routerPrayer = express.Router();

routerPrayer.get('/getPrayers', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const size = Math.min(50, parseInt(req.query.size) || 20);
  const category = req.query.category;
  const filter = category && category !== 'All' ? { category } : {};
  const prayers = await Prayer.find(filter).sort({ createdAt: -1 }).limit(size).skip((page - 1) * size);
  const total = await Prayer.countDocuments(filter);
  res.json({ prayers, total, page, size });
}));

routerPrayer.post('/create', strictLimiter, asyncHandler(async (req, res) => {
  const { name, country, prayer, category } = req.body;
  if (!name || !prayer) return res.status(400).json({ error: 'Name and prayer are required' });
  const newPrayer = new Prayer({ name, country, prayer, category });
  await newPrayer.save();
  res.status(201).json(newPrayer);
}));

routerPrayer.post('/like/:id', asyncHandler(async (req, res) => {
  const p = await Prayer.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
  if (!p) return res.status(404).json({ error: 'Prayer not found' });
  res.json({ likes: p.likes });
}));

routerPrayer.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await Prayer.findByIdAndDelete(req.params.id);
  res.json({ message: 'Prayer deleted' });
}));

export default routerPrayer;
