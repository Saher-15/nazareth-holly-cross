import { cache } from 'react';
import { isProductId } from '@/components/shop/catalog';
import { fetchProduct } from '@/components/shop/products';
import { ApiError, type Product } from '@/lib/api';

export type ProductResult = { status: 'ok'; product: Product } | { status: 'notFound' } | { status: 'error' };

// One fetch per request, shared by generateMetadata and the page.
// A malformed id never reaches the API; the API's 404 (and 400 for a bad id) mean
// "no such product", anything else (5xx, network, unexpected data) is an outage.
export const loadProduct = cache(async (id: string): Promise<ProductResult> => {
  if (!isProductId(id)) return { status: 'notFound' };
  try {
    return { status: 'ok', product: await fetchProduct(id) };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return { status: 'notFound' };
    console.error(`[shop] could not load product ${id}`, error);
    return { status: 'error' };
  }
});
