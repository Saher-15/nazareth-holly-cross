import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import CandleStrip from '@/components/home/CandleStrip';
import FollowUs from '@/components/home/FollowUs';
import HomeHero, { HERO_ID, HERO_POSTER } from '@/components/home/HomeHero';
import { homeJsonLd } from '@/components/home/jsonLd';
import NewestPrayers from '@/components/home/NewestPrayers';
import OpeningDoor from '@/components/home/OpeningDoor';
import SitesMap from '@/components/home/SitesMap';
import SitesCarousel from '@/components/home/SitesCarousel';
import Souvenirs from '@/components/home/Souvenirs';
import { placeCards } from '@/data/places/places';
import StickyCta from '@/components/home/StickyCta';
import Story from '@/components/home/Story';
import TodayInNazareth from '@/components/home/TodayInNazareth';
import VerseOfDay from '@/components/home/VerseOfDay';
import Voices from '@/components/home/Voices';
import JsonLd from '@/components/ui/JsonLd';
import { routing } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';
import styles from './home.module.css';

// Rendered per request (the CSP nonce, docs/PERFORMANCE.md); the API reads below it are cached by Next's data cache
// (products 10 minutes, reviews 2, prayers 1) and the live schedule is peeked at most once a minute.
export const revalidate = 3600;

const ids = {
  today: 'home-today',
  candle: 'home-candle',
  sites: 'home-sites',
  map: 'home-map',
  verse: 'home-verse',
  shop: 'home-shop',
  prayers: 'home-prayers',
  voices: 'home-voices',
  follow: 'home-follow',
  story: 'home-story',
};

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'homePage.meta' });
  const title = t('title');
  const description = t('description');
  return pageMetadata({ locale, path: '/', title, description, image: HERO_POSTER, absoluteTitle: true });
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  // Pages render alongside the layout, so check the language here too (e.g. /favicon.ico).
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();

  const jsonLd = homeJsonLd({
    locale,
    siteName: t('site.name'),
    title: t('homePage.meta.title'),
    description: t('homePage.meta.description'),
  });

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      {/* The opening of the site: once per visit, never for reduced motion (lib/intro.ts) */}
      <OpeningDoor />
      <HomeHero nextSectionId={ids.today} />
      <TodayInNazareth id={ids.today} locale={locale} />
      {/* Every other section on a full-width band (home.module.css): the page's rhythm. */}
      <div className={`${styles.band} ${styles.bandWarm}`}>
        <CandleStrip id={ids.candle} />
      </div>
      <SitesCarousel id={ids.sites} cards={placeCards({ withTour: true })} />
      <div className={styles.band}>
        <SitesMap id={ids.map} />
      </div>
      <VerseOfDay id={ids.verse} locale={locale} />
      <div className={styles.band}>
        <Souvenirs id={ids.shop} locale={locale} />
      </div>
      <NewestPrayers id={ids.prayers} />
      <Voices id={ids.voices} />
      <div className={styles.band}>
        <FollowUs id={ids.follow} />
      </div>
      <Story id={ids.story} />
      <StickyCta watchId={HERO_ID} />
    </div>
  );
}
