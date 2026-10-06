import { localCountryName } from '@/components/checkout/countries';
import type { Review } from './api';

/**
 * Where a reviewer comes from, in the reader's language when it is a country from the list. Reviews have a `place`
 * field since 2026-10-06; older ones keep it in `email`. A value that looks like an e-mail address is never shown.
 */
export function reviewerPlace(review: Pick<Review, 'email'> & { place?: string }, locale = 'en'): string {
  const place = (review.place || review.email || '').trim();
  return place.includes('@') ? '' : localCountryName(place, locale);
}
