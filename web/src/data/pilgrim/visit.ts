// Static facts of the visitor guide (/visit). Texts are messages; only numbers live here.

export type Season = 'best' | 'good' | 'hot' | 'cool';

/** Typical climate of Nazareth by month (January first): daily high and low in °C, rain in millimetres.
 *  Rounded long-term averages for a hill town (about 350 m above sea level); real weather varies. */
export const CLIMATE: readonly { high: number; low: number; rain: number; season: Season }[] = [
  { high: 14, low: 6, rain: 150, season: 'cool' },
  { high: 15, low: 7, rain: 110, season: 'cool' },
  { high: 18, low: 9, rain: 75, season: 'good' },
  { high: 23, low: 12, rain: 25, season: 'best' },
  { high: 27, low: 16, rain: 8, season: 'best' },
  { high: 30, low: 19, rain: 0, season: 'hot' },
  { high: 32, low: 22, rain: 0, season: 'hot' },
  { high: 32, low: 22, rain: 0, season: 'hot' },
  { high: 31, low: 20, rain: 2, season: 'good' },
  { high: 27, low: 17, rain: 25, season: 'best' },
  { high: 21, low: 12, rain: 80, season: 'good' },
  { high: 16, low: 8, rain: 125, season: 'cool' },
];

export const celsiusToFahrenheit = (c: number) => Math.round((c * 9) / 5 + 32);

/** Ways to reach Nazareth, with the usual distance by road from each starting point (kilometres). */
export const ROUTES = [
  { id: 'haifa', km: 36 },
  { id: 'telaviv', km: 110 },
  { id: 'airport', km: 120 },
] as const;
