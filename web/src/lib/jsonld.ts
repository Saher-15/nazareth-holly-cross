import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from './config';
import { absoluteUrl, localePath } from './seo';
import { socialLinks } from './site';

// Structured data (schema.org JSON-LD) shared by the pages.

export type JsonLd = Record<string, unknown>;

/**
 * JSON for a `<script type="application/ld+json">`. `<` is escaped so text from visitors (review bodies,
 * names) can never close the script tag (see node_modules/next/dist/docs/01-app/02-guides/json-ld.md).
 */
export function serializeJsonLd(data: JsonLd | readonly JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** The organisation behind the site. `id` makes it referable from other nodes of a `@graph`. */
export function organizationJsonLd({ name = SITE_NAME, id }: { name?: string; id?: string } = {}): JsonLd {
  return {
    '@type': 'Organization',
    ...(id ? { '@id': id } : {}),
    name,
    url: SITE_URL,
    logo: absoluteUrl('/images/logo.webp'),
    email: CONTACT_EMAIL,
    sameAs: socialLinks.map((s) => s.href),
  };
}

type Crumb = { name: string; path: string };

/** Breadcrumb trail; the last item is the current page. */
export function breadcrumbJsonLd(locale: string, items: readonly Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(localePath(locale, item.path)),
    })),
  };
}

/** An ordered list of pages (the holy sites index, the stops of the tour). */
export function itemListJsonLd(locale: string, name: string, items: readonly Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: absoluteUrl(localePath(locale, item.path)),
    })),
  };
}
