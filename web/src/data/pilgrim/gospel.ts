import type { PlaceSlug } from '@/data/places/places';

// The Gospel passages on /gospel, in the order of the story. Quotes are messages, never hard-coded text:
// `quote` and `ref` are full message keys. The verses already used on the home page (home.v1..v5) are reused,
// so every page of the site quotes a verse in the same words.

export type Passage = {
  id: string;
  quote: string;
  ref: string;
  /** Message key of the short reflection. */
  reflection: string;
  place: PlaceSlug;
};

export const PASSAGES: readonly Passage[] = [
  { id: 'luke1-26', quote: 'pilgrim.gospel.p.luke126.quote', ref: 'pilgrim.gospel.p.luke126.ref', reflection: 'pilgrim.gospel.p.luke126.text', place: 'city' },
  { id: 'luke1-30', quote: 'home.v1', ref: 'home.r1', reflection: 'pilgrim.gospel.p.luke130.text', place: 'latin' },
  { id: 'luke1-38', quote: 'home.v5', ref: 'home.r5', reflection: 'pilgrim.gospel.p.luke138.text', place: 'greek' },
  { id: 'matthew2-23', quote: 'home.v3', ref: 'home.r3', reflection: 'pilgrim.gospel.p.matthew223.text', place: 'city' },
  { id: 'luke2-40', quote: 'home.v4', ref: 'home.r4', reflection: 'pilgrim.gospel.p.luke240.text', place: 'oldcity' },
  { id: 'luke2-51', quote: 'pilgrim.gospel.p.luke251.quote', ref: 'pilgrim.gospel.p.luke251.ref', reflection: 'pilgrim.gospel.p.luke251.text', place: 'maryswell' },
  { id: 'luke4-16', quote: 'pilgrim.gospel.p.luke416.quote', ref: 'pilgrim.gospel.p.luke416.ref', reflection: 'pilgrim.gospel.p.luke416.text', place: 'oldcity' },
  { id: 'john1-46', quote: 'home.v2', ref: 'home.r2', reflection: 'pilgrim.gospel.p.john146.text', place: 'city' },
];
