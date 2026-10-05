import { PLACES, placeHref } from '@/data/places/places';
import { PASSAGES } from '@/data/pilgrim/gospel';
import { FAQ_GROUPS } from '@/data/pilgrim/faq';
import { faqItems, type Translate } from '@/data/pilgrim/faqEntries';
import { legalNav, mainNav, pilgrimNav } from '@/lib/site';
import type { SearchEntry } from '@/lib/search';

// The search index of one language: pages, holy sites, FAQ entries and Gospel passages, built from the messages.
// It is served as a static file per language (app/[locale]/search-index.json) and loaded the first time the
// visitor opens the search, so it never weighs on a page.

/** Where each existing page's description lives in the messages. */
const PAGE_DESCRIPTION: Partial<Record<string, string>> = {
  home: 'homePage.meta.description',
  sites: 'placesPage.meta.sitesDescription',
  tour: 'placesPage.meta.tourDescription',
  candle: 'checkoutPage.meta.candleDescription',
  shop: 'shopPage.meta.shopDescription',
  live: 'communityPage.live.metaDescription',
  reviews: 'communityPage.reviews.metaDescription',
  about: 'placesPage.meta.aboutDescription',
  donate: 'checkoutPage.meta.donateDescription',
};

export function buildSearchIndex(t: Translate, locale: string): SearchEntry[] {
  const pages: SearchEntry[] = [
    ...mainNav.map((item) => ({
      id: `page-${item.key}`,
      type: 'page' as const,
      title: t(`site.nav.${item.key}`),
      text: PAGE_DESCRIPTION[item.key] ? t(PAGE_DESCRIPTION[item.key]!) : '',
      href: item.href,
    })),
    { id: 'page-about', type: 'page', title: t('site.nav.about'), text: t(PAGE_DESCRIPTION.about!), href: '/about' },
    { id: 'page-donate', type: 'page', title: t('site.nav.donate'), text: t(PAGE_DESCRIPTION.donate!), href: '/donate' },
    ...pilgrimNav.map((item) => ({
      id: `page-${item.key}`,
      type: 'page' as const,
      title: t(`pilgrim.nav.${item.key}`),
      text: t(`pilgrim.${item.key}.meta.description`),
      href: item.href,
    })),
    ...legalNav.map((item) => {
      const meta = item.key === 'faq' ? 'pilgrim.faq.meta' : `pilgrim.legal.${item.key}.meta`;
      return {
        id: `page-${item.key}`,
        type: 'page' as const,
        title: t(`pilgrim.nav.${item.key}`),
        text: t(`${meta}.description`),
        href: item.href,
      };
    }),
  ];

  const sites: SearchEntry[] = PLACES.map((place) => ({
    id: `site-${place.slug}`,
    type: 'site',
    title: t(place.nameKey),
    text: `${t(`placesPage.kind.${place.slug}`)}. ${t(`placesPage.teaser.${place.slug}`)}`,
    href: placeHref(place.slug),
  }));

  const faq: SearchEntry[] = faqItems(t, locale, FAQ_GROUPS).map((item) => ({
    id: `faq-${item.anchor}`,
    type: 'faq',
    title: item.question,
    text: item.answer,
    href: `/faq#${item.anchor}`,
  }));

  const gospel: SearchEntry[] = PASSAGES.map((p) => ({
    id: `gospel-${p.id}`,
    type: 'gospel',
    title: `${t(p.ref)}`,
    text: `${t(p.quote)} ${t(p.reflection)}`,
    href: `/gospel#${p.id}`,
  }));

  return [...pages, ...sites, ...faq, ...gospel];
}
