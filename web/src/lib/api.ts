import './zodConfig';
import { z } from 'zod';
import { API_URL } from './config';
import { parseRecordings } from './liveRecordings';
import { parseSchedule } from './liveSchedule';
import { decodeEntities } from './plainText';
import { CANDLE_PRICE } from './pricing';

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

// Text people typed (visitors on the site, the team in the dashboard) is stored HTML-escaped by the API's input
// sanitiser ("Fish & Loaves" is saved as "Fish &amp; Loaves"). It is shown as text, so it is decoded here, once.
const visitorText = z.string().transform(decodeEntities);
const visitorTextOrEmpty = text.transform(decodeEntities);

export const productSchema = z.object({
  _id: z.string(),
  name: visitorText,
  price: z.number(),
  img: imageUrl,
  additionalImageUrls: list(imageUrl),
  description: visitorTextOrEmpty,
  rate: num(0),
  color: list(visitorText),
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
  name: visitorText,
  country: visitorTextOrEmpty,
  rating: z.number(),
  title: visitorTextOrEmpty,
  comment: visitorText,
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

export const reviewSchema = z.object({
  _id: z.string(),
  fullName: visitorText,
  place: visitorTextOrEmpty.optional(), // where the reviewer is from (since 2026-10-06; absent from older API answers)
  email: visitorTextOrEmpty, // older reviews (and older API versions) keep the place here
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

// The API rate-limits (429: 200 requests per 15 minutes per address, shared by every visitor of a shared host
// such as Netlify) and its host sometimes answers 502-504 while waking up. What reaches a visitor must never be
// worse than the last answer we had:
//   1. a read is retried with a growing pause (and a much longer one while `next build` runs, where nobody waits);
//   2. when it still fails, the last good answer for the same address is used instead (stale-if-error), so a
//      refresh during a rate limit or an outage keeps the shop on screen instead of replacing it with an error;
//   3. identical reads that are in flight at the same moment share one request.
// Only an address that has never been read successfully in this process can still fail, and then the caller
// shows its own error state.
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
const MAX_BUILD_RETRIES = 5;
const MAX_WAIT_MS = 3000;
const MAX_BUILD_WAIT_MS = 20_000;
const building = () => process.env.NEXT_PHASE === 'phase-production-build';

export const retryDelayMs = (attempt: number, retryAfter: string | null, maxMs = MAX_WAIT_MS) => {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, maxMs);
  return Math.min(400 * 2 ** attempt + Math.floor(Math.random() * 300), maxMs);
};

const LAST_GOOD_LIMIT = 300;
const lastGood = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

/** Forgets the stored answers (tests). */
export function clearApiMemory() {
  lastGood.clear();
  inFlight.clear();
}

function remember(path: string, data: unknown) {
  lastGood.delete(path);
  lastGood.set(path, data);
  if (lastGood.size > LAST_GOOD_LIMIT) lastGood.delete(lastGood.keys().next().value as string);
}

async function fetchJson<T>(path: string, schema: z.ZodType<T>, { revalidate = 300, init, timeoutMs = 10_000 }: FetchOptions) {
  const retries = building() ? MAX_BUILD_RETRIES : MAX_RETRIES;
  const maxWait = building() ? MAX_BUILD_WAIT_MS : MAX_WAIT_MS;
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
    if (!RETRY_STATUSES.has(res.status) || res.headers.get('cf-mitigated') || attempt >= retries || init?.signal?.aborted) break;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt, res.headers.get('retry-after'), maxWait)));
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

export async function getJson<T>(path: string, schema: z.ZodType<T>, options: FetchOptions = {}): Promise<T> {
  // A read with its own abort signal belongs to one caller: it is neither shared nor remembered.
  if (options.init?.signal) return fetchJson(path, schema, options);

  const pending = inFlight.get(path) as Promise<T> | undefined;
  if (pending) return pending;

  const read = fetchJson(path, schema, options).then(
    (data) => {
      remember(path, data);
      return data;
    },
    (error: unknown) => {
      // "Not found" is an answer, not a failure: never replaced by an older page of the same address.
      if (error instanceof ApiError && error.status === 404) throw error;
      if (lastGood.has(path)) {
        console.warn(`[api] ${path} failed (${error instanceof Error ? error.message : error}); serving the last good answer`);
        return lastGood.get(path) as T;
      }
      throw error;
    },
  );
  inFlight.set(path, read);
  // Remove the entry when the read ends; the returned promise (not this one) carries the result or the error.
  read.then(
    () => inFlight.delete(path),
    () => inFlight.delete(path),
  );
  return read;
}

// The catalogue changes a few times a week, and every refresh is a request against the API's rate limit: ten
// minutes (and thirty for the "similar products" lists), served stale-while-revalidate by Next's data cache.
const CATALOG_REVALIDATE = 600;

const id = (value: string) => encodeURIComponent(value);

const candleVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationSeconds: z.number(),
  thumbnailUrl: z.string().url().refine((u) => /^https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\//.test(u)),
  playbackUrl: z.string().url().refine((u) => /^https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\//.test(u)),
});
export type CandleVideo = z.infer<typeof candleVideoSchema>;

export const api = {
  // The candle page's published videos (server/services/candleVideos.js). A minute old at most; none on an API failure.
  candleVideos: () => getJson('/candle/videos', z.array(candleVideoSchema), { revalidate: 60, timeoutMs: 5_000 }).catch((): CandleVideo[] => []),
  // The owner's candle price (server/services/siteSettings.js), what create_order charges. A minute old at most.
  candlePrice: () =>
    getJson('/candle/price', z.object({ price: z.number().positive(), currency: z.literal('USD') }), { revalidate: 60, timeoutMs: 5_000 })
      .then((r) => r.price)
      .catch(() => CANDLE_PRICE),
  products: (page = 1, size = 24) =>
    getJson(`/product/getNProducts?page=${page}&size=${size}`, productPageSchema).then((r) => r.data),
  product: (productId: string) => getJson(`/product/getProduct/${id(productId)}`, productSchema),
  catalog: () => getJson('/product/catalog', catalogSchema, { revalidate: CATALOG_REVALIDATE }),
  bestSellers: (limit = 8) =>
    getJson(`/product/bestSellers?limit=${limit}`, z.array(catalogProductSchema), { revalidate: CATALOG_REVALIDATE }),
  similar: (productId: string, limit = 4) =>
    getJson(`/product/${id(productId)}/similar?limit=${limit}`, z.array(catalogProductSchema), { revalidate: CATALOG_REVALIDATE * 3 }),
  productReviews: (productId: string) =>
    getJson(`/product/${id(productId)}/reviews`, productReviewsSchema, { revalidate: 60 }),
  reviews: () => getJson('/review/getReviews', z.array(reviewSchema), { revalidate: 120 }),
  prayers: (page = 1, size = 20, category?: string) =>
    getJson(
      `/prayer/getPrayers?page=${page}&size=${size}${category ? `&category=${encodeURIComponent(category)}` : ''}`,
      z.object({ prayers: z.array(prayerSchema), total: z.number() }),
      { revalidate: 60 },
    ),
  // The /live page (docs/LIVE.md): announced broadcasts and published recordings. Each item is checked on its own
  // (lib/liveSchedule.ts, lib/liveRecordings.ts); a bad one is dropped, the rest still shows.
  liveSchedule: () => getJson('/live/schedule', z.unknown().transform(parseSchedule), { revalidate: 60, timeoutMs: 5_000 }),
  liveRecordings: () => getJson('/live/recordings', z.unknown().transform(parseRecordings), { revalidate: 60, timeoutMs: 5_000 }),
};
