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

// Photo credits: the licence and author of every photograph on the site (messages media.nav.credits).
// The gallery itself is `pilgrimNav` 'gallery'.
export const creditsPage = { key: 'credits', href: '/credits', labelKey: 'media.nav.credits' } as const;

// Pilgrim guides and community pages (footer group, sitemap, site search). Labels: messages pilgrim.nav.<key>.
export const pilgrimNav = [
  { key: 'plan', href: '/plan' },
  { key: 'visit', href: '/visit' },
  { key: 'gospel', href: '/gospel' },
  { key: 'gallery', href: '/gallery' },
  { key: 'prayers', href: '/prayers' },
  { key: 'contact', href: '/contact' },
] as const;

// Help and legal pages. `shipping` is /shipping-returns.
export const legalNav = [
  { key: 'faq', href: '/faq' },
  { key: 'shipping', href: '/shipping-returns' },
  { key: 'privacy', href: '/privacy' },
  { key: 'terms', href: '/terms' },
] as const;

export const socialLinks = [
  { name: 'Instagram', href: 'https://www.instagram.com/nazareth_holy_cross/' },
  { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61566447860803' },
  { name: 'YouTube', href: 'https://www.youtube.com/@nazarethholycross' },
] as const;
