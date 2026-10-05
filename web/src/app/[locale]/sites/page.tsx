import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PLACES, TOUR_CARD, mediaPhoto, placeHref } from '@/data/places/places';
import PhotoImage from '@/components/places/PhotoImage';
import PlaceHero from '@/components/places/PlaceHero';
import SiteList from '@/components/places/SiteList';
import { PlayIcon } from '@/components/places/icons';
import JsonLd from '@/components/ui/JsonLd';
import Reveal from '@/components/ui/Reveal';
import { breadcrumbJsonLd, itemListJsonLd, webPageJsonLd } from '@/lib/jsonLd';
import { pageMetadata } from '@/lib/seo';
import styles from './page.module.css';

const HERO = mediaPhoto('city-sunset-glow');

export async function generateMetadata({ params }: PageProps<'/[locale]/sites'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'placesPage.meta' });
  return pageMetadata({
    locale,
    path: '/sites',
    title: t('sitesTitle'),
    description: t('sitesDescription'),
    image: HERO,
  });
}

// /sites: the five holy places of Nazareth as large cards, then the virtual tour.
export default async function SitesPage({ params }: PageProps<'/[locale]/sites'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const jsonLd = [
    webPageJsonLd(locale, {
      path: '/sites',
      name: t('placesPage.meta.sitesTitle'),
      description: t('placesPage.meta.sitesDescription'),
    }),
    itemListJsonLd(
      locale,
      t('placesPage.meta.sitesTitle'),
      PLACES.map((p) => ({ name: t(p.nameKey), path: placeHref(p.slug) })),
    ),
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('site.nav.sites'), path: '/sites' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero
        image={HERO}
        size="medium"
        eyebrow={t('home.sitesEyebrow')}
        title={t('placesPage.index.title')}
        lead={t('placesPage.index.lead')}
      >
        <a href="#sites-list" className="ui-btn ui-btn--gold">
          {t('home.explore')}
        </a>
        <Link href="/tour" className="ui-btn ui-btn--glass">
          <PlayIcon size={18} />
          {t('home.siteTour')}
        </Link>
      </PlaceHero>

      <section id="sites-list" className={`ui-section ${styles.list}`} aria-labelledby="sites-list-title">
        <div className="ui-container">
          <Reveal as="header" className={styles.head}>
            <p className="ui-eyebrow">{t('placesPage.index.listEyebrow')}</p>
            <h2 id="sites-list-title" className="ui-h2">
              {t('home.sitesTitle')}
            </h2>
          </Reveal>
          <SiteList places={PLACES} />
        </div>
      </section>

      <section className="ui-section" aria-labelledby="sites-tour-title">
        <div className="ui-container">
          <Reveal className={styles.band}>
            <PhotoImage className={styles.bandBg} photo={TOUR_CARD.cover} alt="" sizes="(min-width: 1212px) 1180px, 100vw" />
            <div className={styles.bandBody}>
              <p className="ui-eyebrow">{t('home.siteTour')}</p>
              <h2 id="sites-tour-title" className="ui-h2">
                {t('placesPage.index.tourTitle')}
              </h2>
              <p className={styles.bandText}>{t('placesPage.index.tourText')}</p>
              <div className={styles.bandActions}>
                <Link href="/tour" className="ui-btn ui-btn--gold">
                  <PlayIcon size={18} />
                  {t('placesPage.tourWatchEyebrow')}
                </Link>
                <Link href="/candle" className="ui-btn ui-btn--glass">
                  {t('home.stickyCandle')}
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
