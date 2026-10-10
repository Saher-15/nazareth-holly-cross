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

// The header's menu. "Reviews" is left out while the site has no published reviews (owner's brief, 2026-10-10: an
// empty reviews page in the main menu costs trust); the page stays reachable from the footer and the site search.
// Put it back here once real reviews have been published.
export const headerNav = mainNav.filter((item) => item.key !== 'reviews');

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

// Help and legal pages. `shipping` is /shipping-returns; `accessibility` is the accessibility statement (also linked
// from the accessibility settings in the header).
export const legalNav = [
  { key: 'faq', href: '/faq' },
  { key: 'shipping', href: '/shipping-returns' },
  { key: 'privacy', href: '/privacy' },
  { key: 'terms', href: '/terms' },
  { key: 'accessibility', href: '/accessibility' },
] as const;

export const socialLinks = [
  { name: 'Instagram', href: 'https://www.instagram.com/nazareth_holy_cross/' },
  { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61566447860803' },
  { name: 'YouTube', href: 'https://www.youtube.com/@nazarethholycross' },
] as const;
