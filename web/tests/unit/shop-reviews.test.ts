import { describe, expect, it } from 'vitest';
import type { ProductReviews } from '@/lib/api';
import {
  emptyReview,
  firstInvalidField,
  mergeReviews,
  submitErrorKey,
  toReviewPayload,
  validateReview,
} from '@/lib/shop/reviews';

const valid = { ...emptyReview, name: 'Maria', rating: 5, comment: 'Beautiful!' };

describe('validateReview', () => {
  it('accepts a review within the API limits', () => {
    expect(validateReview(valid)).toEqual({});
    expect(validateReview({ ...valid, country: '', title: '' })).toEqual({});
  });

  it('flags missing and too short fields, in form order', () => {
    const errors = validateReview(emptyReview);
    expect(errors).toEqual({
      name: { key: 'nameRequired' },
      rating: { key: 'ratingRequired' },
      comment: { key: 'commentRequired' },
    });
    expect(firstInvalidField(errors)).toBe('name');
    expect(validateReview({ ...valid, name: ' M ', comment: 'ok' })).toEqual({
      name: { key: 'nameTooShort', values: { min: 2 } },
      comment: { key: 'commentTooShort', values: { min: 3 } },
    });
  });

  it('flags text over the limits and a rating outside 1-5', () => {
    expect(validateReview({ ...valid, name: 'x'.repeat(81) }).name).toEqual({ key: 'tooLong', values: { max: 80 } });
    expect(validateReview({ ...valid, country: 'x'.repeat(81) }).country?.key).toBe('tooLong');
    expect(validateReview({ ...valid, title: 'x'.repeat(121) }).title).toEqual({ key: 'tooLong', values: { max: 120 } });
    expect(validateReview({ ...valid, comment: 'x'.repeat(1001) }).comment).toEqual({ key: 'tooLong', values: { max: 1000 } });
    expect(validateReview({ ...valid, rating: 6 }).rating?.key).toBe('ratingRequired');
    expect(validateReview({ ...valid, rating: 2.5 }).rating?.key).toBe('ratingRequired');
  });
});

describe('toReviewPayload / submitErrorKey', () => {
  it('trims the text and keeps the (empty) honeypot', () => {
    expect(toReviewPayload({ ...valid, name: ' Maria ', country: ' Rome ', comment: ' Beautiful! ' })).toEqual({
      name: 'Maria',
      country: 'Rome',
      rating: 5,
      title: '',
      comment: 'Beautiful!',
      website: '',
    });
  });

  it('maps API answers to messages', () => {
    expect(submitErrorKey(422)).toBe('invalid');
    expect(submitErrorKey(429)).toBe('rateLimited');
    expect(submitErrorKey(0)).toBe('network');
    expect(submitErrorKey(503)).toBe('server');
  });
});

describe('mergeReviews', () => {
  const server: ProductReviews = {
    summary: { avg: 4, count: 2, distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 } },
    reviews: [
      { _id: 'r2', name: 'B', country: '', rating: 5, title: '', comment: 'Great', createdAt: '2026-10-02' },
      { _id: 'r1', name: 'A', country: '', rating: 3, title: '', comment: 'Fine', createdAt: '2026-10-01' },
    ],
  };

  it('builds the 5-to-1 breakdown from the server data', () => {
    const { summary, reviews } = mergeReviews(server, []);
    expect(summary).toMatchObject({ avg: 4, count: 2 });
    expect(summary.rows.map((r) => [r.stars, r.count, r.share])).toEqual([
      [5, 1, 50],
      [4, 0, 0],
      [3, 1, 50],
      [2, 0, 0],
      [1, 0, 0],
    ]);
    expect(reviews.map((r) => r._id)).toEqual(['r2', 'r1']);
  });

  it('adds a just-posted review first and updates the average', () => {
    const posted = { _id: 'r3', name: 'C', country: 'Rome', rating: 1, title: '', comment: 'Broken', createdAt: '2026-10-03' };
    const { summary, reviews } = mergeReviews(server, [posted]);
    expect(reviews[0]._id).toBe('r3');
    expect(summary.count).toBe(3);
    expect(summary.avg).toBe(3);
    expect(summary.rows.find((r) => r.stars === 1)?.count).toBe(1);
  });

  it('does not count a posted review twice once the server returns it', () => {
    const { summary, reviews } = mergeReviews(server, [server.reviews[0]]);
    expect(reviews).toHaveLength(2);
    expect(summary.count).toBe(2);
  });

  it('works without server data (reviews could not be loaded)', () => {
    const { summary } = mergeReviews(null, [{ name: 'A', country: '', rating: 4, title: '', comment: 'Nice' }]);
    expect(summary).toMatchObject({ avg: 4, count: 1 });
    expect(mergeReviews(null, []).summary).toMatchObject({ avg: 0, count: 0 });
  });
});

describe('the posted review (browser, zod/mini) reads answers exactly like the server schema', () => {
  it('decodes the same text and fills the same defaults', async () => {
    const { productReviewSchema } = await import('@/lib/api');
    const { parsePostedReview } = await import('@/lib/postedReview');
    const answers: unknown[] = [
      { name: 'Tom &amp; Ann', country: 'Trinidad &amp; Tobago', rating: 5, title: 'Lovely &lt;3', comment: 'Wood &amp; glass' },
      { _id: 'a1', name: 'Mia', country: null, rating: 4, title: undefined, comment: 'Good', createdAt: '2026-10-01T10:00:00Z' },
      { name: 'Mia', rating: 4, comment: 'Good', createdAt: null },
    ];
    for (const answer of answers) expect(parsePostedReview(answer)).toEqual(productReviewSchema.parse(answer));
    for (const bad of [null, 'Created', { name: 'x', rating: '5', comment: 'y' }, { rating: 5, comment: 'y' }]) {
      expect(parsePostedReview(bad)).toBeNull();
      expect(productReviewSchema.safeParse(bad).success).toBe(false);
    }
  });
});
