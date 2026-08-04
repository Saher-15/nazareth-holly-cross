import express from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../model/admin.js';
import Prayer from '../model/prayer.js';
import Candle from '../model/candle.js';
import Product from '../model/product.js';
import { requireAdmin } from '../middleware/auth.js';
import { loginLimiter } from '../utils/security.js';

const router = express.Router();

const safeError = (err) =>
  process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

// POST /admin/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    const admin = await Admin.findOne({ username });
    if (!admin || !(await admin.comparePassword(password))) {
      console.warn(
        `[${new Date().toISOString()}] Failed admin/login attempt for username="${username}" from IP: ${ip}`
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '8h', algorithm: 'HS256' }
    );
    res.json({ token, username: admin.username });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
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
    res.status(500).json({ error: safeError(err) });
  }
});

// --- PRAYERS ---
router.get('/prayers', requireAdmin, async (req, res) => {
  try {
    const prayers = await Prayer.find().sort({ createdAt: -1 });
    res.json(prayers);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/prayers/:id', requireAdmin, async (req, res) => {
  try {
    await Prayer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Prayer deleted' });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- CANDLES ---
router.get('/candles', requireAdmin, async (req, res) => {
  try {
    const candles = await Candle.find().sort({ createdAt: -1 });
    res.json(candles);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/candles/:id', requireAdmin, async (req, res) => {
  try {
    await Candle.findByIdAndDelete(req.params.id);
    res.json({ message: 'Candle deleted' });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// --- PRODUCTS ---
router.get('/products', requireAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// Whitelist fields to prevent mass assignment
router.post('/products', requireAdmin, async (req, res) => {
  try {
    const { name, price, img, additionalImageUrls, description, uuidv4_, rate, color, stock } = req.body;
    const product = new Product({ name, price, img, additionalImageUrls, description, uuidv4_, rate, color, stock });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.put('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { name, price, img, additionalImageUrls, description, uuidv4_, rate, color, stock } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, img, additionalImageUrls, description, uuidv4_, rate, color, stock },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
