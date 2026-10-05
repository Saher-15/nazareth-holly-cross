import { z } from 'zod';
import { api, ApiError, productSchema, type Product } from '@/lib/api';
import { API_URL } from '@/lib/config';

// Server-side product reads for the shop.
//
// TEMPORARY FALLBACK: the live API stores `color: null` for products without colours
// (57 of the 62 products on 2026-10-05). `productSchema` in lib/api.ts only accepts an
// array there, so api.products() / api.product() reject real data with a 502 ApiError.
// Until lib/api.ts accepts null (asked for in the port report), a 502 is retried here
// with the same request (served from Next's fetch cache) and the same schema, after
// turning a null colour into "no colours". Once lib/api.ts is fixed this path is unused.

const tolerantProduct = z.preprocess(
  (raw) => (raw && typeof raw === 'object' && 'color' in raw && raw.color === null ? { ...raw, color: [] } : raw),
  productSchema,
);

async function getTolerant<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  // Same URL, headers and revalidate as lib/api.ts, so this hits the cached response.
  const res = await fetch(`${API_URL}${path}`, { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
  if (!res.ok) throw new ApiError(`GET ${path} failed with ${res.status}`, res.status);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new ApiError(`GET ${path} returned unexpected data: ${parsed.error.message}`, 502);
  return parsed.data;
}

const isSchemaError = (error: unknown) => error instanceof ApiError && error.status === 502;

/** Every product (the API caps a page at 100; the shop has 62). */
export async function fetchProducts(): Promise<Product[]> {
  try {
    return await api.products(1, 100);
  } catch (error) {
    if (!isSchemaError(error)) throw error;
    const page = await getTolerant('/product/getNProducts?page=1&size=100', z.object({ data: z.array(tolerantProduct) }));
    return page.data;
  }
}

export async function fetchProduct(id: string): Promise<Product> {
  try {
    return await api.product(id);
  } catch (error) {
    if (!isSchemaError(error)) throw error;
    return getTolerant(`/product/getProduct/${encodeURIComponent(id)}`, tolerantProduct);
  }
}
