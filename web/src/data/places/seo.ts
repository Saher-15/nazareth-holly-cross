import type { JsonLd } from '@/lib/jsonld';
import { absoluteUrl, localePath } from '@/lib/seo';
import type { Place } from './places';

// Structured data of a holy place. Page metadata, breadcrumbs and list markup are shared: see
// lib/seo.ts and lib/jsonld.ts.

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
