import express from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../model/admin.js';
import Prayer from '../model/prayer.js';
import Candle from '../model/candle.js';
import Product from '../model/product.js';
import { requireAdmin } from '../middleware/auth.js';
import { loginLimiter } from '../utils/security.js';
import { config } from '../config/env.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

// POST /admin/login
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const admin = await Admin.findOne({ username });
  if (!admin || !(await admin.comparePassword(password))) {
    console.warn(
      `[${new Date().toISOString()}] Failed admin/login attempt for username=${JSON.stringify(username.slice(0, 100))} from IP: ${ip}`
    );
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin._id, username: admin.username },
    config.jwtSecret,
    { expiresIn: '8h', algorithm: 'HS256' }
  );
  res.json({ token, username: admin.username });
}));

// GET /admin/stats
router.get('/stats', requireAdmin, asyncHandler(async (req, res) => {
  const [prayers, candles, products] = await Promise.all([
    Prayer.countDocuments(),
    Candle.countDocuments(),
    Product.countDocuments(),
  ]);
  const totalLikes = await Prayer.aggregate([{ $group: { _id: null, total: { $sum: '$likes' } } }]);
  res.json({ prayers, candles, products, totalLikes: totalLikes[0]?.total || 0 });
}));

// --- PRAYERS ---
router.get('/prayers', requireAdmin, asyncHandler(async (req, res) => {
  const prayers = await Prayer.find().sort({ createdAt: -1 });
  res.json(prayers);
}));

router.delete('/prayers/:id', requireAdmin, asyncHandler(async (req, res) => {
  await Prayer.findByIdAndDelete(req.params.id);
  res.json({ message: 'Prayer deleted' });
}));

// --- CANDLES ---
router.get('/candles', requireAdmin, asyncHandler(async (req, res) => {
  const candles = await Candle.find().sort({ createdAt: -1 });
  res.json(candles);
}));

router.delete('/candles/:id', requireAdmin, asyncHandler(async (req, res) => {
  await Candle.findByIdAndDelete(req.params.id);
  res.json({ message: 'Candle deleted' });
}));

// --- PRODUCTS ---
router.get('/products', requireAdmin, asyncHandler(async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
}));

// Whitelist fields to prevent mass assignment
router.post('/products', requireAdmin, asyncHandler(async (req, res) => {
  const { name, price, img, additionalImageUrls, description, uuidv4_, rate, color, stock } = req.body;
  const product = new Product({ name, price, img, additionalImageUrls, description, uuidv4_, rate, color, stock });
  await product.save();
  res.status(201).json(product);
}));

router.put('/products/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { name, price, img, additionalImageUrls, description, uuidv4_, rate, color, stock } = req.body;
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { name, price, img, additionalImageUrls, description, uuidv4_, rate, color, stock },
    { new: true, runValidators: true }
  );
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
}));

router.delete('/products/:id', requireAdmin, asyncHandler(async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Product deleted' });
}));

export default router;
