import type { Review } from './api';

/**
 * Where a reviewer comes from. The API stores it in the review's `email` field; a value that looks like an
 * e-mail address (older reviews) is never shown.
 */
export function reviewerPlace(review: Pick<Review, 'email'>): string {
  const place = review.email.trim();
  return place.includes('@') ? '' : place;
}
