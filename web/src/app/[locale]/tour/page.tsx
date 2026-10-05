import type { Metadata } from 'next';
import { getImageProps } from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PLACES, TOUR_CARD, photo, placeCards, placeHref } from '@/data/places/places';
import PlaceCards from '@/components/places/PlaceCards';
import PlaceHero from '@/components/places/PlaceHero';
import JsonLd from '@/components/ui/JsonLd';
import Reveal from '@/components/ui/Reveal';
import { breadcrumbJsonLd, webPageJsonLd } from '@/lib/jsonLd';
import { absoluteUrl, localePath, pageMetadata } from '@/lib/seo';
import styles from './page.module.css';

const TOUR_VIDEO =
  'https://firebasestorage.googleapis.com/v0/b/nazareth-holy-cross.appspot.com/o/videos%2Ftour.mp4?alt=media&token=af5c1463-2e97-4ae3-b205-a7566f45f9be';
const POSTER = photo('nazareth', 1, { 1: 'webp' });

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

  // The poster goes through the image optimizer like every other photo (resized, AVIF/WebP).
  const { props: poster } = getImageProps({ src: POSTER.src, width: POSTER.width, height: POSTER.height, alt: '' });

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
              poster={poster.src}
              aria-labelledby="tour-watch-title"
            >
              <source src={TOUR_VIDEO} type="video/mp4" />
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
    </div>
  );
}
