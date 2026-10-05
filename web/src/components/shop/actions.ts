'use server';

import { revalidatePath } from 'next/cache';
import { locales } from '@/i18n/routing';
import { isProductId } from './catalog';

// Called by the review form once the API has accepted a review, so the product page
// (cached for a few minutes) is rebuilt now in every language with the new review and
// rating. It takes only a product id, checks its shape, and only re-reads public data.
export async function revalidateProduct(id: string): Promise<void> {
  if (typeof id !== 'string' || !isProductId(id)) return;
  for (const locale of locales) revalidatePath(`/${locale}/shop/${id}`);
}
