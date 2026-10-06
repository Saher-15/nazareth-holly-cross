'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { countryOptions, type CountryOption } from './countries';

const noSubscription = () => () => {};

/**
 * The country list for a form, built in the browser only. Country names come from Intl, and the server's ICU data
 * (Node) and the browser's do not always agree ("Turkey" / "Türkiye", accents, order), so options rendered on the
 * server made React refuse to hydrate the page (error #418). During server rendering and hydration the list is empty
 * (the placeholder option alone); React renders it again with the full list right after.
 */
export function useCountryOptions(locale: string): CountryOption[] {
  const inBrowser = useSyncExternalStore(noSubscription, () => true, () => false);
  return useMemo(() => (inBrowser ? countryOptions(locale) : []), [inBrowser, locale]);
}
