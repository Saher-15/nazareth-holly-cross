'use server';

import { revalidatePath } from 'next/cache';

// Called by the prayer form once the API has accepted a prayer, so the wall (cached for a minute) is rebuilt now,
// in every language and for every category and page. It takes no input and only re-reads the public list.
export async function revalidatePrayers(): Promise<void> {
  revalidatePath('/[locale]/prayers', 'page');
}
