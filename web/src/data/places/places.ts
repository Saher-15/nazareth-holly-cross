import { PHOTO_SIZES, type PhotoFolder } from './photos';

// The holy places of Nazareth: one statically generated page each at /sites/<slug>.
// Texts are message keys (the story texts are the existing contentLatin/contentGreek/... messages);
// photos live in public/images/<folder>/<folder><n>.jpg.

export type Photo = { src: string; width: number; height: number };

type Ext = Partial<Record<number, 'webp'>>;

/** Photo number `n` (from 1) of a folder. `ext` lists the photo numbers that are .webp instead of .jpg. */
export function photo(folder: PhotoFolder, n: number, ext: Ext = {}): Photo {
  const size = PHOTO_SIZES[folder][n - 1];
  if (!size) throw new Error(`No photo ${n} in /images/${folder}`);
  return { src: `/images/${folder}/${folder}${n}.${ext[n] ?? 'jpg'}`, width: size[0], height: size[1] };
}

/** Every photo of a folder, in order. */
export function photosOf(folder: PhotoFolder, ext: Ext = {}): Photo[] {
  return PHOTO_SIZES[folder].map((_, i) => photo(folder, i + 1, ext));
}

export const PLACE_SLUGS = ['latin', 'greek', 'maryswell', 'oldcity', 'city'] as const;
export type PlaceSlug = (typeof PLACE_SLUGS)[number];

/** A paragraph, a titled section, or a titled list of [title, text] points. */
export type StoryBlock =
  | { kind: 'text'; text: string }
  | { kind: 'section'; title: string; text: string }
  | { kind: 'points'; title: string; points: readonly (readonly [title: string, text: string])[] };

export type Place = {
  slug: PlaceSlug;
  /** Route of this place on the old (CRA) site, kept for redirects. */
  legacyPath: string;
  /** Message keys: short name (cards, hero) and the story heading. */
  nameKey: string;
  titleKey: string;
  hero: Photo;
  cover: Photo;
  mapUrl: string;
  geo: { lat: number; lng: number };
  /** schema.org types for the JSON-LD of the page. */
  schemaTypes: readonly string[];
  photos: readonly Photo[];
  story: readonly StoryBlock[];
};

const OLD_EXT: Ext = { 5: 'webp' };
const CITY_EXT: Ext = { 1: 'webp', 7: 'webp', 8: 'webp' };

const latin: Place = {
  slug: 'latin',
  legacyPath: '/latin',
  nameKey: 'home.siteLatin',
  titleKey: 'headerLatin.title',
  hero: photo('latin', 1),
  cover: photo('latin', 1),
  // The old site pointed at "Nazareth City center"; this opens the basilica itself.
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Basilica+of+the+Annunciation%2C+Nazareth',
  geo: { lat: 32.70222, lng: 35.2975 },
  schemaTypes: ['TouristAttraction', 'CatholicChurch'],
  photos: photosOf('latin'),
  story: [
    { kind: 'text', text: 'contentLatin.paragraph1' },
    { kind: 'section', title: 'contentLatin.history.title', text: 'contentLatin.history.text' },
    { kind: 'section', title: 'contentLatin.architecture.title', text: 'contentLatin.architecture.text' },
    { kind: 'section', title: 'contentLatin.visiting.title', text: 'contentLatin.visiting.text' },
  ],
};

const greek: Place = {
  slug: 'greek',
  legacyPath: '/greek',
  nameKey: 'home.siteGreek',
  titleKey: 'headerGreek.title',
  hero: photo('greek', 9),
  cover: photo('greek', 1),
  mapUrl:
    'https://www.google.com/maps/place/The+Greek+Orthodox+Church+of+the+Annunciation/@32.7070723,35.3016619,17z/data=!3m1!4b1!4m6!3m5!1s0x151c4c29d17b5477:0xc7296709e9a3ab85!8m2!3d32.7070723!4d35.3016619!16s%2Fm%2F03gtxsl?entry=ttu',
  geo: { lat: 32.7070723, lng: 35.3016619 },
  schemaTypes: ['TouristAttraction', 'Church'],
  photos: photosOf('greek'),
  story: [
    { kind: 'text', text: 'contentGreek.paragraph1' },
    { kind: 'text', text: 'contentGreek.paragraph2' },
    { kind: 'text', text: 'contentGreek.paragraph3' },
  ],
};

const maryswell: Place = {
  slug: 'maryswell',
  legacyPath: '/maryswell',
  nameKey: 'home.siteMary',
  titleKey: 'headerMary.title',
  hero: photo('mary', 5),
  cover: photo('mary', 4),
  mapUrl:
    'https://www.google.com/maps/place/Mary%E2%80%99s+Well/@32.7035145,35.296555,14z/data=!4m6!3m5!1s0x151c4c29c6d1008d:0x23e218b489e18311!8m2!3d32.7060586!4d35.3013417!16zL20vMGY3XzJ2?entry=ttu',
  geo: { lat: 32.7060586, lng: 35.3013417 },
  schemaTypes: ['TouristAttraction', 'LandmarksOrHistoricalBuildings'],
  photos: photosOf('mary'),
  story: [
    { kind: 'text', text: 'contentMary.intro' },
    {
      kind: 'points',
      title: 'contentMary.significance.title',
      points: [
        ['contentMary.significance.biblical', 'contentMary.significance.biblicalText'],
        ['contentMary.significance.cultural', 'contentMary.significance.culturalText'],
        ['contentMary.significance.architecture', 'contentMary.significance.architectureText'],
      ],
    },
    {
      kind: 'points',
      title: 'contentMary.modern.title',
      points: [
        ['contentMary.modern.restoration', 'contentMary.modern.restorationText'],
        ['contentMary.modern.attraction', 'contentMary.modern.attractionText'],
        ['contentMary.modern.surroundings', 'contentMary.modern.surroundingsText'],
      ],
    },
    {
      kind: 'points',
      title: 'contentMary.visiting.title',
      points: [
        ['contentMary.visiting.location', 'contentMary.visiting.locationText'],
        ['contentMary.visiting.accessibility', 'contentMary.visiting.accessibilityText'],
        ['contentMary.visiting.culturalExperience', 'contentMary.visiting.culturalExperienceText'],
      ],
    },
  ],
};

const oldcity: Place = {
  slug: 'oldcity',
  legacyPath: '/oldcity',
  nameKey: 'home.siteOld',
  titleKey: 'headerTitleOld',
  hero: photo('old', 9),
  cover: photo('old', 2),
  mapUrl:
    'https://www.google.com/maps/place/The+Old+City,+Nazareth/@32.7035145,35.296555,14z/data=!3m1!4b1!4m6!3m5!1s0x151c4c2c9a805123:0x994648ecbf8111f3!8m2!3d32.703515!4d35.296555!16s%2Fg%2F1v5wddhc?entry=ttu',
  geo: { lat: 32.703515, lng: 35.296555 },
  schemaTypes: ['TouristAttraction'],
  photos: photosOf('old', OLD_EXT),
  story: [
    { kind: 'text', text: 'mapDescriptionOld' },
    { kind: 'text', text: 'churchDescriptionOld' },
    { kind: 'text', text: 'waterSourceOld' },
  ],
};

const city: Place = {
  slug: 'city',
  legacyPath: '/city',
  nameKey: 'home.siteCity',
  titleKey: 'headerTitleNaz',
  hero: photo('nazareth', 1, CITY_EXT),
  cover: photo('nazareth', 1, CITY_EXT),
  mapUrl:
    'https://www.google.com/maps/place/Nazareth+City+center/@32.7012442,35.2981717,17z/data=!3m1!4b1!4m6!3m5!1s0x151c4dd4b3386aef:0x652378b0cec4d358!8m2!3d32.7012442!4d35.2981717!16s%2Fg%2F11c5s6wx03?entry=ttu',
  geo: { lat: 32.7012442, lng: 35.2981717 },
  schemaTypes: ['TouristAttraction', 'City'],
  photos: photosOf('nazareth', CITY_EXT),
  story: [
    { kind: 'text', text: 'contentNaz.introduction' },
    { kind: 'section', title: 'contentNaz.historicalSignificance.title', text: 'contentNaz.historicalSignificance.text' },
    { kind: 'section', title: 'contentNaz.modernNazareth.title', text: 'contentNaz.modernNazareth.text' },
    { kind: 'section', title: 'contentNaz.accessibility.title', text: 'contentNaz.accessibility.text' },
  ],
};

/** The places, in the order every list shows them. */
export const PLACES: readonly Place[] = [latin, greek, maryswell, oldcity, city];

export const isPlaceSlug = (value: string): value is PlaceSlug =>
  (PLACE_SLUGS as readonly string[]).includes(value);

export const getPlace = (slug: string): Place | undefined => PLACES.find((p) => p.slug === slug);

export const placeHref = (slug: PlaceSlug) => `/sites/${slug}` as const;

/** Google Maps directions to a place, from wherever the visitor is. */
export const directionsUrl = ({ lat, lng }: Place['geo']) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}`;

/** A photo card linking somewhere: a place, or the virtual tour. */
export type PlaceCard = { key: string; href: string; nameKey: string; cover: Photo };

export const TOUR_CARD: PlaceCard = {
  key: 'tour',
  href: '/tour',
  nameKey: 'home.siteTour',
  cover: photo('old', 11),
};

export const placeCard = (place: Place): PlaceCard => ({
  key: place.slug,
  href: placeHref(place.slug),
  nameKey: place.nameKey,
  cover: place.cover,
});

/** Cards for the places (optionally without one), optionally followed by the tour. */
export function placeCards({ exclude, withTour = false }: { exclude?: PlaceSlug; withTour?: boolean } = {}) {
  const cards = PLACES.filter((p) => p.slug !== exclude).map(placeCard);
  return withTour ? [...cards, TOUR_CARD] : cards;
}

/** Old site routes that moved, and where they live now (paths without the language prefix). */
export const LEGACY_REDIRECTS: readonly { from: string; to: string }[] = PLACES.map((p) => ({
  from: p.legacyPath,
  to: placeHref(p.slug),
}));
