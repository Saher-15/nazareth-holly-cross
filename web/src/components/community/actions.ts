'use server';

import { revalidatePath } from 'next/cache';

// Called by the review form once the API has accepted a review, so the wall (cached for two minutes)
// is rebuilt now, in every language, and the visitor sees the new state without reloading.
// It takes no input and only re-reads the public review list. A server action is a public endpoint,
// so repeated calls inside a few seconds do nothing: nobody can use it to keep the wall rebuilding.
const MIN_GAP_MS = 5_000;
let lastRun = 0;

export async function revalidateReviews(): Promise<void> {
  const now = Date.now();
  if (now - lastRun < MIN_GAP_MS) return;
  lastRun = now;
  revalidatePath('/[locale]/reviews', 'page');
}
