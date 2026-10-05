import type { MetadataRoute } from 'next';

// Lets phones add the site to the home screen with the right name, colours and icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nazareth Holy Cross',
    short_name: 'Nazareth',
    description: 'Walk where Jesus walked: the holy sites of Nazareth, a prayer candle and souvenirs from the Holy Land.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0e1a',
    theme_color: '#0a0e1a',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/images/logo.webp', sizes: '1024x1024', type: 'image/webp', purpose: 'any' },
    ],
  };
}
