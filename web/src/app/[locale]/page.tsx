import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import CandleStrip from '@/components/home/CandleStrip';
import HomeHero, { HERO_ID, HERO_POSTER } from '@/components/home/HomeHero';
import { homeJsonLd, serializeJsonLd } from '@/components/home/jsonLd';
import SitesCarousel from '@/components/home/SitesCarousel';
import Souvenirs from '@/components/home/Souvenirs';
import StickyCta from '@/components/home/StickyCta';
import Story from '@/components/home/Story';
import VerseOfDay from '@/components/home/VerseOfDay';
import Voices from '@/components/home/Voices';
import { routing } from '@/i18n/routing';

// Static page, regenerated in the background: products every 5 minutes, reviews every
// 2 (their fetches ask for it), and at least hourly so the verse follows the date.
export const revalidate = 3600;

const ids = {
  candle: 'home-candle',
  sites: 'home-sites',
  verse: 'home-verse',
  shop: 'home-shop',
  voices: 'home-voices',
  story: 'home-story',
};

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'homePage.meta' });
  const title = t('title');
  const description = t('description');
  return {
    title: { absolute: title },
    description,
    openGraph: {
      type: 'website',
      siteName: 'Nazareth Holy Cross',
      url: `/${locale}`,
      title,
      description,
      locale,
      images: [{ url: HERO_POSTER }],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <HomeHero nextSectionId={ids.candle} />
      <CandleStrip id={ids.candle} />
      <SitesCarousel id={ids.sites} />
      <VerseOfDay id={ids.verse} locale={locale} />
      <Souvenirs id={ids.shop} locale={locale} />
      <Voices id={ids.voices} />
      <Story id={ids.story} />
      <StickyCta watchId={HERO_ID} />
    </div>
  );
}
