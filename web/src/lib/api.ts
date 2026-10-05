import { z } from 'zod';
import { API_URL } from './config';

// Every response from the API is validated before the UI touches it, so a bad
// record shows up as a clear error instead of a broken page.

// Some stored image URLs were HTML-escaped ("&amp;token=") by an old sanitiser.
const imageUrl = z.string().transform((u) => u.replace(/&amp;/g, '&'));

export const productSchema = z.object({
  _id: z.string(),
  name: z.string(),
  price: z.number(),
  img: imageUrl,
  additionalImageUrls: z.array(imageUrl).optional().default([]),
  description: z.string().optional().default(''),
  rate: z.number().optional().default(0),
  color: z.array(z.string()).optional().default([]),
  stock: z.number().nullable().optional().default(null),
});
export type Product = z.infer<typeof productSchema>;

const productPageSchema = z.object({
  page: z.number(),
  size: z.number(),
  data: z.array(productSchema),
});

export const reviewSchema = z.object({
  _id: z.string(),
  fullName: z.string(),
  email: z.string().optional().default(''), // holds the reviewer's country
  msg: z.string(),
  createdAt: z.string().optional(),
});
export type Review = z.infer<typeof reviewSchema>;

export const prayerSchema = z.object({
  _id: z.string(),
  name: z.string(),
  country: z.string().optional().default(''),
  prayer: z.string(),
  category: z.string().optional().default('Personal'),
  likes: z.number().optional().default(0),
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

type FetchOptions = { revalidate?: number | false; init?: RequestInit };

async function getJson<T>(path: string, schema: z.ZodType<T>, { revalidate = 300, init }: FetchOptions = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
    next: revalidate === false ? undefined : { revalidate },
  });
  if (!res.ok) throw new ApiError(`GET ${path} failed with ${res.status}`, res.status);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) {
    throw new ApiError(`GET ${path} returned unexpected data: ${parsed.error.message}`, 502);
  }
  return parsed.data;
}

export const api = {
  products: (page = 1, size = 24) =>
    getJson(`/product/getNProducts?page=${page}&size=${size}`, productPageSchema).then((r) => r.data),
  product: (id: string) => getJson(`/product/getProduct/${encodeURIComponent(id)}`, productSchema),
  reviews: () => getJson('/review/getReviews', z.array(reviewSchema), { revalidate: 120 }),
  prayers: (page = 1, size = 20) =>
    getJson(
      `/prayer/getPrayers?page=${page}&size=${size}`,
      z.object({ prayers: z.array(prayerSchema), total: z.number() }),
      { revalidate: 60 },
    ),
};
