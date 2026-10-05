// The cards of the holy-sites carousel: where each one leads, its cover photo and
// the message key (namespace `home`) of its name.
export const homeSites = [
  { href: '/sites/latin', img: '/images/latin/latin1.jpg', nameKey: 'siteLatin' },
  { href: '/sites/greek', img: '/images/greek/greek1.jpg', nameKey: 'siteGreek' },
  { href: '/sites/maryswell', img: '/images/mary/mary4.jpg', nameKey: 'siteMary' },
  { href: '/sites/oldcity', img: '/images/old/old2.jpg', nameKey: 'siteOld' },
  { href: '/sites/city', img: '/images/nazareth/nazareth1.webp', nameKey: 'siteCity' },
  { href: '/tour', img: '/images/old/old11.jpg', nameKey: 'siteTour' },
] as const;

export type HomeSite = (typeof homeSites)[number];
