import express from 'express';
import Review from '../model/review.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { strictLimiter } from '../utils/security.js';
import { isText } from '../utils/validate.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** Where a reviewer is from: the place field, or (older reviews, older clients) an `email` that is not an address. */
export const placeOf = (review) => text(review.place) || (EMAIL.test(text(review.email)) ? '' : text(review.email));

// What the public may see of a review: never its e-mail address or phone number. `email` repeats the place for
// clients built before `place` existed (they read the place from it); it is never an address.
const publicReview = (r) => {
  const place = placeOf(r);
  return { _id: r._id, fullName: r.fullName, place, email: place, msg: r.msg, createdAt: r.createdAt };
};

const routerReview = express.Router();

// Public: list approved reviews, newest first
routerReview.get('/getReviews', asyncHandler(async (req, res) => {
  const reviews = await Review.find({ approved: true })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json(reviews.map(publicReview));
}));

// Public: submit a review
routerReview.post('/addReview', strictLimiter, asyncHandler(async (req, res) => {
  const { fullName, phone, msg } = req.body ?? {};
  // The place comes in `place`; clients built before it existed send it in `email` (which must otherwise be a real
  // address): such a value is moved to `place` instead of failing the e-mail check.
  let email = text(req.body?.email);
  let place = text(req.body?.place);
  if (!place && email && !EMAIL.test(email)) {
    place = email;
    email = '';
  }
  if (!isText(fullName) || !isText(msg)) {
    return res.status(400).json({ error: 'Name and review message are required' });
  }
  // Only these fields are taken (`approved` can never be set by a visitor).
  const review = new Review({ fullName, email, place, phone, msg });
  await review.save(); // a ValidationError here becomes a 400 in the error handler
  res.status(201).json(publicReview(review));
}));

export default routerReview;
