import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from './config';
import { absoluteUrl, localePath } from './seo';
import { socialLinks } from './site';

// Structured data (schema.org JSON-LD) shared by the pages.

export type JsonLd = Record<string, unknown>;

// The one way structured data (schema.org JSON-LD) is turned into the text of a
// <script type="application/ld+json">. Every JSON-LD block of the site is written as raw HTML text and
// must go through here (tests/unit/security.test.ts enforces it); see node_modules/next/dist/docs/01-app/02-guides/json-ld.md.
//
// Text that visitors wrote (review bodies, names) can end up in the data, so the output must never be
// able to close the script element or start HTML: "<", ">" and "&" are written as unicode escapes,
// which JSON.parse reads back as the same characters. The line and paragraph separators (code points
// 0x2028 and 0x2029) are escaped too: they are valid in JSON but were line terminators in JavaScript
// string literals, and some parsers still trip over them. (Built from code points on purpose, so the
// source file itself never contains those invisible characters.)
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

const unicodeEscape = (char: string) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');

const UNSAFE = new RegExp(`[<>&${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`, 'g');

export function serializeJsonLd(data: unknown): string {
  const json = JSON.stringify(data) ?? 'null';
  return json.replace(UNSAFE, unicodeEscape);
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
