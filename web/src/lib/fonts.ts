import { Amiri, EB_Garamond, Frank_Ruhl_Libre, Heebo, IBM_Plex_Sans_Arabic, Inter } from 'next/font/google';

// Self-hosted at build time by next/font: no request to Google from the visitor's browser.
// Latin/Cyrillic/Greek fonts are preloaded; Hebrew and Arabic load only on those pages.
export const serif = EB_Garamond({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'greek'],
  variable: '--font-serif',
  display: 'swap',
});
export const sans = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'greek'],
  variable: '--font-sans',
  display: 'swap',
});
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
export const arSans = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  variable: '--font-ar-sans',
  display: 'swap',
  preload: false,
});

export const fontVariables = [serif, sans, heSerif, heSans, arSerif, arSans]
  .map((font) => font.variable)
  .join(' ');
