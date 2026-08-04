import express from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../model/admin.js';
import Prayer from '../model/prayer.js';
import Candle from '../model/candle.js';
import Product from '../model/product.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// POST /admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, username: admin.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [prayers, candles, products] = await Promise.all([
      Prayer.countDocuments(),
      Candle.countDocuments(),
      Product.countDocuments(),
    ]);
    const totalLikes = await Prayer.aggregate([{ $group: { _id: null, total: { $sum: '$likes' } } }]);
    res.json({ prayers, candles, products, totalLikes: totalLikes[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PRAYERS ---
router.get('/prayers', requireAdmin, async (req, res) => {
  try {
    const prayers = await Prayer.find().sort({ createdAt: -1 });
    res.json(prayers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/prayers/:id', requireAdmin, async (req, res) => {
  try {
    await Prayer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Prayer deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CANDLES ---
router.get('/candles', requireAdmin, async (req, res) => {
  try {
    const candles = await Candle.find().sort({ createdAt: -1 });
    res.json(candles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/candles/:id', requireAdmin, async (req, res) => {
  try {
    await Candle.findByIdAndDelete(req.params.id);
    res.json({ message: 'Candle deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PRODUCTS ---
router.get('/products', requireAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products', requireAdmin, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
