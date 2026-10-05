import express from 'express';
import Review from '../model/review.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { strictLimiter } from '../utils/security.js';
import { isText } from '../utils/validate.js';

const routerReview = express.Router();

// Public: list approved reviews, newest first
routerReview.get('/getReviews', asyncHandler(async (req, res) => {
  const reviews = await Review.find({ approved: true })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json(reviews);
}));

// Public: submit a review
routerReview.post('/addReview', strictLimiter, asyncHandler(async (req, res) => {
  const { fullName, email, phone, msg } = req.body ?? {};
  if (!isText(fullName) || !isText(msg)) {
    return res.status(400).json({ error: 'Name and review message are required' });
  }
  // Only these four fields are taken (`approved` can never be set by a visitor).
  const review = new Review({ fullName, email, phone, msg });
  await review.save(); // a ValidationError here becomes a 400 in the error handler
  res.status(201).json(review);
}));

// Admin: delete a review
routerReview.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await Review.findByIdAndDelete(req.params.id);
  res.json({ message: 'Review deleted' });
}));

export default routerReview;
