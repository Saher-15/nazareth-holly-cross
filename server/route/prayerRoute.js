import express from 'express';
import Prayer from '../model/prayer.js';
import { requireAdmin } from '../middleware/auth.js';

const routerPrayer = express.Router();

routerPrayer.get('/getPrayers', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const size = Math.min(50, parseInt(req.query.size) || 20);
    const category = req.query.category;
    const filter = category && category !== 'All' ? { category } : {};
    const prayers = await Prayer.find(filter).sort({ createdAt: -1 }).limit(size).skip((page - 1) * size);
    const total = await Prayer.countDocuments(filter);
    res.json({ prayers, total, page, size });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

routerPrayer.post('/create', async (req, res) => {
  try {
    const { name, country, prayer, category } = req.body;
    if (!name || !prayer) return res.status(400).json({ error: 'Name and prayer are required' });
    const newPrayer = new Prayer({ name, country, prayer, category });
    await newPrayer.save();
    res.status(201).json(newPrayer);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

routerPrayer.post('/like/:id', async (req, res) => {
  try {
    const p = await Prayer.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
    if (!p) return res.status(404).json({ error: 'Prayer not found' });
    res.json({ likes: p.likes });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

routerPrayer.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await Prayer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Prayer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default routerPrayer;
