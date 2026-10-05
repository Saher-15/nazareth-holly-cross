import { z } from 'zod';
import { API_URL } from './config';
import { decodeEntities } from './plainText';

// Every response from the API is validated before the UI touches it, so a bad
// record shows up as a clear error instead of a broken page. Old records hold
// null in optional fields, so those are normalised to safe defaults.

// Some stored image URLs were HTML-escaped ("&amp;token=") by an old sanitiser.
const imageUrl = z.string().transform((u) => u.replace(/&amp;/g, '&'));
const list = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform((v) => v ?? []);
const text = z
  .string()
  .nullish()
  .transform((v) => v ?? '');
const num = (fallback: number) =>
  z
    .number()
    .nullish()
    .transform((v) => v ?? fallback);

export const productSchema = z.object({
  _id: z.string(),
  name: z.string(),
  price: z.number(),
  img: imageUrl,
  additionalImageUrls: list(imageUrl),
  description: text,
  rate: num(0),
  color: list(z.string()),
  stock: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
});
export type Product = z.infer<typeof productSchema>;

const productPageSchema = z.object({
  page: z.number(),
  size: z.number(),
  data: z.array(productSchema),
});

// --- storefront catalog (server/services/catalog.js) ---

export const CATEGORIES = [
  'rosaries',
  'necklaces',
  'bracelets',
  'stained-glass',
  'crosses',
  'bibles',
  'holy-land',
  'gifts',
] as const;
export type Category = (typeof CATEGORIES)[number];
export const MATERIALS = ['gold', 'silver', 'wood', 'glass'] as const;
export type Material = (typeof MATERIALS)[number];

const ratingSchema = z.object({ avg: z.number(), count: z.number() });

export const catalogProductSchema = productSchema.omit({ rate: true }).extend({
  category: z.string().transform((c) => ((CATEGORIES as readonly string[]).includes(c) ? (c as Category) : 'gifts')),
  materials: list(z.string()).transform((m) => m.filter((x): x is Material => (MATERIALS as readonly string[]).includes(x))),
  featured: num(0),
  sold: num(0),
  rating: ratingSchema.nullish().transform((r) => r ?? { avg: 0, count: 0 }),
  createdAt: z.string().nullish(),
});
export type CatalogProduct = z.infer<typeof catalogProductSchema>;

const catalogSchema = z.object({
  categories: z.array(z.object({ key: z.string(), count: z.number() })),
  products: z.array(catalogProductSchema),
});

export const productReviewSchema = z.object({
  _id: z.string().optional(),
  name: z.string(),
  country: text,
  rating: z.number(),
  title: text,
  comment: z.string(),
  createdAt: z.string().nullish(),
});
export type ProductReview = z.infer<typeof productReviewSchema>;

const productReviewsSchema = z.object({
  summary: z.object({
    avg: z.number(),
    count: z.number(),
    distribution: z.record(z.string(), z.number()),
  }),
  reviews: z.array(productReviewSchema),
});
export type ProductReviews = z.infer<typeof productReviewsSchema>;

// --- site reviews and prayers ---

// Visitor-written text is stored HTML-escaped by the API; it is shown as text, so it is decoded here.
const visitorText = z.string().transform(decodeEntities);
const visitorTextOrEmpty = text.transform(decodeEntities);

export const reviewSchema = z.object({
  _id: z.string(),
  fullName: visitorText,
  email: visitorTextOrEmpty, // holds the reviewer's country
  msg: visitorText,
  createdAt: z.string().optional(),
});
export type Review = z.infer<typeof reviewSchema>;

export const prayerSchema = z.object({
  _id: z.string(),
  name: visitorText,
  country: visitorTextOrEmpty,
  prayer: visitorText,
  category: z
    .string()
    .nullish()
    .transform((v) => v ?? 'Personal'),
  likes: num(0),
  createdAt: z.string().optional(),
});
export type Prayer = z.infer<typeof prayerSchema>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type FetchOptions = { revalidate?: number | false; init?: RequestInit; timeoutMs?: number };

// The API rate-limits (429) and its host sometimes answers 502-504 while waking up. A build renders
// hundreds of pages at once, so without a short retry whole sections would be baked in empty until the
// next revalidation. Two retries at most, never longer than a few seconds in total.
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
export const retryDelayMs = (attempt: number, retryAfter: string | null) => {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 3) * 1000;
  return 400 * 2 ** attempt + Math.floor(Math.random() * 300);
};

async function getJson<T>(
  path: string,
  schema: z.ZodType<T>,
  { revalidate = 300, init, timeoutMs = 10_000 }: FetchOptions = {},
) {
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
      signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
      next: revalidate === false ? undefined : { revalidate },
    });
    // A Cloudflare bot challenge (header cf-mitigated) is not a passing rate limit: asking again only
    // makes the block last longer.
    if (!RETRY_STATUSES.has(res.status) || res.headers.get('cf-mitigated') || attempt >= MAX_RETRIES || init?.signal?.aborted) break;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt, res.headers.get('retry-after'))));
  }
  if (res.status === 404) throw new ApiError(`GET ${path} not found`, 404);
  if (!res.ok) throw new ApiError(`GET ${path} failed with ${res.status}`, res.status);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(`GET ${path} did not return JSON`, 502);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(`GET ${path} returned unexpected data: ${parsed.error.message}`, 502);
  }
  return parsed.data;
}

const id = (value: string) => encodeURIComponent(value);

export const api = {
  products: (page = 1, size = 24) =>
    getJson(`/product/getNProducts?page=${page}&size=${size}`, productPageSchema).then((r) => r.data),
  product: (productId: string) => getJson(`/product/getProduct/${id(productId)}`, productSchema),
  catalog: () => getJson('/product/catalog', catalogSchema, { revalidate: 120 }),
  bestSellers: (limit = 8) =>
    getJson(`/product/bestSellers?limit=${limit}`, z.array(catalogProductSchema), { revalidate: 120 }),
  similar: (productId: string, limit = 4) =>
    getJson(`/product/${id(productId)}/similar?limit=${limit}`, z.array(catalogProductSchema), { revalidate: 300 }),
  productReviews: (productId: string) =>
    getJson(`/product/${id(productId)}/reviews`, productReviewsSchema, { revalidate: 60 }),
  reviews: () => getJson('/review/getReviews', z.array(reviewSchema), { revalidate: 120 }),
  prayers: (page = 1, size = 20) =>
    getJson(
      `/prayer/getPrayers?page=${page}&size=${size}`,
      z.object({ prayers: z.array(prayerSchema), total: z.number() }),
      { revalidate: 60 },
    ),
};
