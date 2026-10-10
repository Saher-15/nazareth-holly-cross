import { Amiri, EB_Garamond, Frank_Ruhl_Libre, Heebo, IBM_Plex_Sans_Arabic, Inter } from 'next/font/google';

// Self-hosted at build time by next/font: no request to Google from the visitor's browser.
// `subsets` decides what is PRELOADED: only the Latin files (two files instead of the eight that listing Latin-extended,
// Cyrillic and Greek too preloads on every page). The other scripts are still declared with their unicode-range, so the
// browser fetches them on demand, only on a page that shows those letters. Do not add a second instance of the same
// family for them: its duplicate @font-face rules make the browser download the Latin file twice.
// Each face has an automatic size-adjusted fallback font (next/font), so the text does not jump when it arrives.
export const serif = EB_Garamond({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });
export const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
export const heSerif = Frank_Ruhl_Libre({
  subsets: ['hebrew'],
  variable: '--font-he-serif',
  display: 'swap',
  preload: false,
});
export const heSans = Heebo({ subsets: ['hebrew'], variable: '--font-he-sans', display: 'swap', preload: false });
export const arSerif = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-ar-serif',
  display: 'swap',
  preload: false,
});
// 400 and 700 only: the 500 of labels falls back to 400 in Arabic (the browser picks the nearest lighter weight), which
// saves a 34 kB file on every form page in Arabic. Hebrew's Heebo is one variable file for all weights.
export const arSans = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-ar-sans',
  display: 'swap',
  preload: false,
});

export const fontVariables = [serif, sans, heSerif, heSans, arSerif, arSans]
  .map((font) => font.variable)
  .join(' ');
