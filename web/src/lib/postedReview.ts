import './zodConfig';
// zod/mini, not zod: this runs in the browser (the product review form), see zodConfig.ts.
import * as z from 'zod/mini';
import { decodeEntities } from './plainText';

// The review the API sends back after POST /product/:id/reviews: the same shape and the same clean-up as
// productReviewSchema in lib/api.ts (server side), written with zod/mini so the product page does not ship the full
// library. tests/unit/shop-reviews.test.ts checks that both read the same answers alike.
const visitorText = z.pipe(z.string(), z.transform(decodeEntities));
const visitorTextOrEmpty = z.pipe(
  z.nullish(z.string()),
  z.transform((v: string | null | undefined) => decodeEntities(v ?? '')),
);

export const postedReviewSchema = z.object({
  _id: z.optional(z.string()),
  name: visitorText,
  country: visitorTextOrEmpty,
  rating: z.number(),
  title: visitorTextOrEmpty,
  comment: visitorText,
  createdAt: z.nullish(z.string()),
});

/** The posted review as the page shows it, or null when the answer does not have that shape. */
export function parsePostedReview(data: unknown) {
  const parsed = z.safeParse(postedReviewSchema, data);
  return parsed.success ? parsed.data : null;
}
