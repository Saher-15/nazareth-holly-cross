import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getMedia, mediaDefaultFile } from '@/data/media';
import { PLACES, TOUR_CARD, placeCards, placeHref } from '@/data/places/places';
import Activities from '@/components/places/Activities';
import PlaceCards from '@/components/places/PlaceCards';
import PlaceHero from '@/components/places/PlaceHero';
import JsonLd from '@/components/ui/JsonLd';
import Reveal from '@/components/ui/Reveal';
import { breadcrumbJsonLd, webPageJsonLd } from '@/lib/jsonLd';
import { absoluteUrl, localePath, pageMetadata } from '@/lib/seo';
import { TOUR_VIDEO } from '@/lib/videos';
import styles from './page.module.css';

// The poster is a licensed 2560 px photo (docs/MEDIA.md): its 1280 px WebP, sharp on a high-density screen.

export async function generateMetadata({ params }: PageProps<'/[locale]/tour'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'placesPage.meta' });
  return pageMetadata({
    locale,
    path: '/tour',
    title: t('tourTitle'),
    description: t('tourDescription'),
    image: TOUR_CARD.cover,
  });
}

// /tour: the video tour of Nazareth (nothing downloads until play), then the holy places.
export default async function TourPage({ params }: PageProps<'/[locale]/tour'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const poster = mediaDefaultFile(getMedia('old-city-arched-passage'));

  const jsonLd = [
    webPageJsonLd(locale, {
      path: '/tour',
      name: t('placesPage.meta.tourTitle'),
      description: t('placesPage.meta.tourDescription'),
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'TouristTrip',
      name: t('placesPage.meta.tourTitle'),
      description: t('placesPage.meta.tourDescription'),
      url: absoluteUrl(localePath(locale, '/tour')),
      itinerary: {
        '@type': 'ItemList',
        itemListElement: PLACES.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'TouristAttraction',
            name: t(p.nameKey),
            url: absoluteUrl(localePath(locale, placeHref(p.slug))),
          },
        })),
      },
    },
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('site.nav.tour'), path: '/tour' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero
        image={TOUR_CARD.cover}
        size="medium"
        eyebrow={t('home.siteTour')}
        title={t('nazarethTour.pageHeading')}
        lead={t('nazarethTour.videoMessage')}
      />

      <section className={`ui-section ${styles.watch}`} aria-labelledby="tour-watch-title">
        <div className={`ui-container ${styles.watchGrid}`}>
          <Reveal className={styles.frame}>
            <video
              className={styles.video}
              controls
              preload="none"
              playsInline
              poster={poster}
              aria-labelledby="tour-watch-title"
            >
              {TOUR_VIDEO.map((source) => (
                <source key={source.src} src={source.src} type={source.type} />
              ))}
              {t('placesPage.videoFallback')}
            </video>
          </Reveal>

          <Reveal className={styles.copy} delay={120}>
            <p className="ui-eyebrow">{t('placesPage.tourWatchEyebrow')}</p>
            <h2 id="tour-watch-title" className="ui-h2">
              {t('placesPage.tourVideoLabel')}
            </h2>
            <p className={styles.text}>{t('nazarethTour.videoDescription')}</p>
            <Link href={placeHref('city')} className="ui-btn ui-btn--gold">
              {t('nazarethTour.ctaButton')}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Things to do in the city: real activities, photo cards (components/places/Activities.tsx) */}
      <Activities id="tour-activities" />

      <section className="ui-section" aria-labelledby="tour-places-title">
        <div className="ui-container">
          <Reveal as="header" className={styles.head}>
            <p className="ui-eyebrow">{t('home.sitesEyebrow')}</p>
            <h2 id="tour-places-title" className="ui-h2">
              {t('home.sitesTitle')}
            </h2>
          </Reveal>
          <PlaceCards cards={placeCards()} />
        </div>
      </section>

      {/* Plan the visit: the pilgrim planner and the visitor guide, which the tour page did not point to */}
      <section className={`ui-section ${styles.plan}`} aria-labelledby="tour-plan-title">
        <Reveal className={`ui-container ${styles.planInner}`}>
          <div>
            <h2 id="tour-plan-title" className="ui-h2">{t('tourPage.plan.title')}</h2>
            <p className={styles.text}>{t('tourPage.plan.lead')}</p>
          </div>
          <div className={styles.planActions}>
            <Link href="/plan" className="ui-btn ui-btn--gold">{t('tourPage.plan.planner')}</Link>
            <Link href="/visit" className="ui-btn ui-btn--ghost">{t('tourPage.plan.guide')}</Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
