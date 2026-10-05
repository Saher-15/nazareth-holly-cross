import type { Metadata } from 'next';
import { locales } from '@/i18n/routing';
import { SITE_URL } from '@/lib/config';
import { ogLocale } from '@/lib/seo';
import type { Photo, Place } from './places';

// Metadata and schema.org JSON-LD for the holy sites, tour and about pages.

/** `/he` + `/sites/latin` → `/he/sites/latin`; the home page is just `/he`. */
export const localePath = (locale: string, path: string) => `/${locale}${path === '/' ? '' : path}`;

export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

type PageMeta = { locale: string; path: string; title: string; description: string; image?: Photo };

/** Title, description, canonical URL, every language version (hreflang) and the social card. */
export function pageMetadata({ locale, path, title, description, image }: PageMeta): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: localePath(locale, path),
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, localePath(l, path)])),
        'x-default': localePath('en', path),
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Nazareth Holy Cross',
      title,
      description,
      locale: ogLocale(locale),
      url: localePath(locale, path),
      ...(image && { images: [{ url: image.src, width: image.width, height: image.height }] }),
    },
  };
}

type JsonLd = Record<string, unknown>;

/** A holy place as a schema.org TouristAttraction (+ PlaceOfWorship subtype for the churches). */
export function placeJsonLd(
  place: Place,
  { locale, name, description }: { locale: string; name: string; description: string },
): JsonLd {
  const url = absoluteUrl(localePath(locale, `/sites/${place.slug}`));
  return {
    '@context': 'https://schema.org',
    '@type': place.schemaTypes,
    '@id': `${url}#place`,
    name,
    description,
    url,
    image: [place.hero, ...place.photos.slice(0, 3)]
      .map((p) => absoluteUrl(p.src))
      .filter((src, i, all) => all.indexOf(src) === i),
    hasMap: place.mapUrl,
    geo: { '@type': 'GeoCoordinates', latitude: place.geo.lat, longitude: place.geo.lng },
    address: { '@type': 'PostalAddress', addressLocality: 'Nazareth', addressCountry: 'IL' },
  };
}

/** Breadcrumb trail; the last item is the current page. */
export function breadcrumbJsonLd(locale: string, items: readonly { name: string; path: string }[]): JsonLd {
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
export function itemListJsonLd(
  locale: string,
  name: string,
  items: readonly { name: string; path: string }[],
): JsonLd {
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

/** JSON for a <script type="application/ld+json">, safe against "</script>" in any text. */
export const serializeJsonLd = (data: JsonLd | JsonLd[]) => JSON.stringify(data).replace(/</g, '\\u003c');
