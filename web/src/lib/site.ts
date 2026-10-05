// Site navigation in one place: header, footer and sitemap all read from here.
export const mainNav = [
  { key: 'home', href: '/' },
  { key: 'sites', href: '/sites' },
  { key: 'tour', href: '/tour' },
  { key: 'candle', href: '/candle' },
  { key: 'shop', href: '/shop' },
  { key: 'live', href: '/live' },
  { key: 'reviews', href: '/reviews' },
] as const;

/** `labelKey` is a full message key for entries whose label is not under `site.nav` (see the `media` namespace). */
type FooterItem = { key: string; href: string; labelKey?: string };

export const footerNav: readonly FooterItem[] = [
  ...mainNav.filter((item) => item.key !== 'home'),
  { key: 'donate', href: '/donate' },
  { key: 'about', href: '/about' },
  { key: 'gallery', href: '/gallery', labelKey: 'media.nav.gallery' },
  { key: 'credits', href: '/credits', labelKey: 'media.nav.credits' },
];

export const socialLinks = [
  { name: 'Instagram', href: 'https://www.instagram.com/nazareth_holy_cross/' },
  { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61566447860803' },
  { name: 'YouTube', href: 'https://www.youtube.com/@nazarethholycross' },
] as const;
