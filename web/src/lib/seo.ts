import type { Metadata } from 'next';
import { locales } from '@/i18n/routing';
import { SITE_NAME, SITE_URL } from './config';

// Canonical URLs, hreflang lists and page metadata. Every page sets its own: the layout deliberately
// sets no canonical, otherwise every page would claim the home page as canonical.

/** `/he` + `/sites/latin` -> `/he/sites/latin`; the home page (`/`) is just `/he`. */
export const localePath = (locale: string, path = '') => `/${locale}${path === '/' ? '' : path}`;

/** A path (or URL) made absolute against the public site address. */
export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

/** Canonical URL + hreflang list for one page in every language. */
export function pageAlternates(locale: string, path = '') {
  return {
    canonical: localePath(locale, path),
    languages: { ...Object.fromEntries(locales.map((l) => [l, localePath(l, path)])), 'x-default': localePath('en', path) },
  };
}

/** A social-card image: a path under /public, optionally with its size. */
export type SocialImage = string | { src: string; width?: number; height?: number };

export type PageMetadataInput = {
  locale: string;
  /** The page's path without the language, e.g. "/reviews"; "/" or "" for the home page. */
  path: string;
  title: string;
  description: string;
  image?: SocialImage;
  /** Use the title as it is, without the " · Nazareth Holy Cross" suffix (the home page). */
  absoluteTitle?: boolean;
  /** Keep the page out of search results (carts, checkouts); crawlers still follow its links. */
  noindex?: boolean;
};

/**
 * Title, description, canonical URL, every language version (hreflang), the Open Graph card and the
 * Twitter card of one page. All pages build theirs here so they stay consistent.
 */
export function pageMetadata({ locale, path, title, description, image, absoluteTitle, noindex }: PageMetadataInput): Metadata {
  const url = localePath(locale, path);
  const picture = typeof image === 'string' ? { src: image } : image;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: pageAlternates(locale, path),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      locale: ogLocale(locale),
      url,
      ...(picture && { images: [{ url: picture.src, width: picture.width, height: picture.height }] }),
    },
    twitter: { card: picture ? 'summary_large_image' : 'summary', title, description },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

// Open Graph wants language_TERRITORY ("he_IL"), not the bare language the URLs use.
const OG_LOCALES: Record<string, string> = {
  en: 'en_US',
  fr: 'fr_FR',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
  pt: 'pt_PT',
  pl: 'pl_PL',
  ru: 'ru_RU',
  el: 'el_GR',
  he: 'he_IL',
  ar: 'ar_AR',
};
export const ogLocale = (locale: string) => OG_LOCALES[locale] ?? 'en_US';
