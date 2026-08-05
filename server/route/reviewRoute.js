import express from 'express';
import Review from '../model/review.js';
import { requireAdmin } from '../middleware/auth.js';

const routerReview = express.Router();

// Public: list approved reviews, newest first
routerReview.get('/getReviews', async (req, res) => {
  try {
    const reviews = await Review.find({ approved: true })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: submit a review
routerReview.post('/addReview', async (req, res) => {
  try {
    const { fullName, email, phone, msg } = req.body;
    if (!fullName || !msg) {
      return res.status(400).json({ error: 'Name and review message are required' });
    }
    const review = new Review({ fullName, email, phone, msg });
    await review.save();
    res.status(201).json(review);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: delete a review
routerReview.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default routerReview;
