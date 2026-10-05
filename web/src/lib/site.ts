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

export const footerNav = [
  ...mainNav.filter((item) => item.key !== 'home'),
  { key: 'donate', href: '/donate' },
  { key: 'about', href: '/about' },
] as const;

export const socialLinks = [
  { name: 'Instagram', href: 'https://www.instagram.com/nazareth_holy_cross/' },
  { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61566447860803' },
  { name: 'YouTube', href: 'https://www.youtube.com/@nazarethholycross' },
] as const;
