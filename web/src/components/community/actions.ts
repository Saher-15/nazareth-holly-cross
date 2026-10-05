'use server';

import { revalidatePath } from 'next/cache';

// Called by the review form once the API has accepted a review, so the wall (cached for two minutes)
// is rebuilt now, in every language, and the visitor sees the new state without reloading.
// It takes no input and only re-reads the public review list.
export async function revalidateReviews(): Promise<void> {
  revalidatePath('/[locale]/reviews', 'page');
}
