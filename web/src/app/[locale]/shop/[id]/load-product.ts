import { cache } from 'react';
import { isProductId } from '@/components/shop/catalog';
import { api, ApiError, type CatalogProduct, type Product } from '@/lib/api';
import { loadCatalogResult } from '@/lib/shop/load';

/** A product as the page needs it. Category and rating are null for one the catalogue does not list yet. */
export type PageProduct = Omit<Product, 'rate'> & {
  category: CatalogProduct['category'] | null;
  rating: CatalogProduct['rating'] | null;
};

export type ProductResult = { status: 'ok'; product: PageProduct } | { status: 'notFound' } | { status: 'error' };

// One read per request, shared by generateMetadata and the page.
// The product comes from the catalogue (one request serves every product page); a product
// added since the catalogue was cached, or every product while the catalogue endpoint is
// failing, is fetched on its own. A malformed id never reaches
// the API; the API's 404 (and 400 for a bad id) mean "no such product", anything else
// (5xx, network, unexpected data) is an outage.
export const loadProduct = cache(async (id: string): Promise<ProductResult> => {
  if (!isProductId(id)) return { status: 'notFound' };
  const catalog = await loadCatalogResult();
  if (catalog.ok) {
    const listed = catalog.data.products.find((p) => p._id === id);
    if (listed) return { status: 'ok', product: listed };
  } else if (catalog.status === 429) {
    // The API's request allowance is used up: asking again for every product would only
    // make it worse, so the page says "try again" and is rebuilt on a later visit.
    return { status: 'error' };
  }
  try {
    const p = await api.product(id);
    const product: PageProduct = {
      _id: p._id,
      name: p.name,
      price: p.price,
      img: p.img,
      additionalImageUrls: p.additionalImageUrls,
      description: p.description,
      color: p.color,
      stock: p.stock,
      category: null,
      rating: null,
    };
    return { status: 'ok', product };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return { status: 'notFound' };
    console.error(`[shop] could not load product ${id}`, error);
    return { status: 'error' };
  }
});
