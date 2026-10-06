import type { ProductReview, ProductReviews } from '@/lib/api';
import { storedLength } from '@/lib/formRules';

// Product reviews: the write-a-review form rules (the same limits as the API's
// POST /product/:id/reviews, so the API never refuses what passes here) and the
// summary shown above the list. No React, so all of it is unit tested.

export type ReviewTextField = 'name' | 'country' | 'title' | 'comment';
export type ReviewValues = Record<ReviewTextField, string> & { rating: number | null };
export type ReviewField = ReviewTextField | 'rating';

export const REVIEW_LIMITS: Record<ReviewTextField, { min: number; max: number }> = {
  name: { min: 2, max: 80 },
  country: { min: 0, max: 80 },
  title: { min: 0, max: 120 },
  comment: { min: 3, max: 1000 },
};

/** The order fields appear in, which is also the order they get focus when invalid. */
export const REVIEW_FIELDS: readonly ReviewField[] = ['name', 'country', 'rating', 'title', 'comment'];

export const emptyReview: ReviewValues = { name: '', country: '', rating: null, title: '', comment: '' };

export type ReviewErrorKey =
  | 'nameRequired'
  | 'nameTooShort'
  | 'ratingRequired'
  | 'commentRequired'
  | 'commentTooShort'
  | 'tooLong';
export type ReviewFieldError = { key: ReviewErrorKey; values?: { min?: number; max?: number } };
export type ReviewErrors = Partial<Record<ReviewField, ReviewFieldError>>;

const REQUIRED: Partial<Record<ReviewTextField, { required: ReviewErrorKey; tooShort: ReviewErrorKey }>> = {
  name: { required: 'nameRequired', tooShort: 'nameTooShort' },
  comment: { required: 'commentRequired', tooShort: 'commentTooShort' },
};

export function validateReviewField(field: ReviewField, values: ReviewValues): ReviewFieldError | undefined {
  if (field === 'rating') {
    const r = values.rating;
    return r !== null && Number.isInteger(r) && r >= 1 && r <= 5 ? undefined : { key: 'ratingRequired' };
  }
  const value = values[field].trim();
  const { min, max } = REVIEW_LIMITS[field];
  const rule = REQUIRED[field];
  if (rule && !value) return { key: rule.required };
  if (rule && value.length < min) return { key: rule.tooShort, values: { min } };
  // The API checks the length of the text as it arrives, after its sanitiser wrote "&" as "&amp;" (lib/formRules.ts).
  if (storedLength(value) > max) return { key: 'tooLong', values: { max } };
  return undefined;
}

export function validateReview(values: ReviewValues): ReviewErrors {
  const errors: ReviewErrors = {};
  for (const field of REVIEW_FIELDS) {
    const error = validateReviewField(field, values);
    if (error) errors[field] = error;
  }
  return errors;
}

export const firstInvalidField = (errors: ReviewErrors) => REVIEW_FIELDS.find((field) => errors[field]);

/** The body the API expects. `website` is the honeypot: real visitors leave it empty. */
export function toReviewPayload(values: ReviewValues, website = '') {
  return {
    name: values.name.trim(),
    country: values.country.trim(),
    rating: values.rating ?? 0,
    title: values.title.trim(),
    comment: values.comment.trim(),
    website,
  };
}

export type SubmitErrorKey = 'invalid' | 'rateLimited' | 'network' | 'server';

/** Which message to show when the API refused the review (status 0 = no answer at all). */
export function submitErrorKey(status: number): SubmitErrorKey {
  if (status === 429) return 'rateLimited';
  if (status === 0) return 'network';
  if (status >= 400 && status < 500) return 'invalid';
  return 'server';
}

const STARS = [5, 4, 3, 2, 1] as const;
const round1 = (n: number) => Math.round(n * 10) / 10;

export type ReviewSummary = {
  avg: number;
  count: number;
  /** 5 stars first; `share` is the bar length in percent of all reviews. */
  rows: { stars: number; count: number; share: number }[];
};

/**
 * The summary with reviews the visitor just posted added in, before the server knows them.
 * Reviews already returned by the server (same id) are not counted twice.
 */
export function mergeReviews(
  server: ProductReviews | null,
  posted: ProductReview[],
): { summary: ReviewSummary; reviews: ProductReview[] } {
  const known = new Set((server?.reviews ?? []).map((r) => r._id).filter(Boolean));
  const fresh = posted.filter((r) => !r._id || !known.has(r._id));
  const reviews = [...fresh, ...(server?.reviews ?? [])];

  const baseCount = server?.summary.count ?? 0;
  const baseAvg = server?.summary.avg ?? 0;
  const count = baseCount + fresh.length;
  const avg = count ? round1((baseAvg * baseCount + fresh.reduce((n, r) => n + r.rating, 0)) / count) : 0;

  const dist = new Map<number, number>(STARS.map((s) => [s, Number(server?.summary.distribution[String(s)] ?? 0)]));
  fresh.forEach((r) => dist.set(r.rating, (dist.get(r.rating) ?? 0) + 1));
  const listed = [...dist.values()].reduce((a, b) => a + b, 0);
  const rows = STARS.map((stars) => {
    const n = dist.get(stars) ?? 0;
    return { stars, count: n, share: listed ? Math.round((n / listed) * 100) : 0 };
  });

  return { summary: { avg, count, rows }, reviews };
}
