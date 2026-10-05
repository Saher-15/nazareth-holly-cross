import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PLACE_SLUGS, getPlace, placeCards, placeHref } from '@/data/places/places';
import { breadcrumbJsonLd, pageMetadata, placeJsonLd } from '@/data/places/seo';
import ExternalLink from '@/components/places/ExternalLink';
import JsonLd from '@/components/places/JsonLd';
import PlaceCards from '@/components/places/PlaceCards';
import PlaceGallery from '@/components/places/PlaceGallery';
import PlaceHero from '@/components/places/PlaceHero';
import PlaceStory from '@/components/places/PlaceStory';
import VisitCard from '@/components/places/VisitCard';
import { PhotosIcon, PinIcon } from '@/components/places/icons';
import PageTools from '@/components/ui/PageTools';
import Reveal from '@/components/ui/Reveal';
import styles from './page.module.css';

// Only the five places exist; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return PLACE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/sites/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const place = getPlace(slug);
  if (!place) return {};
  const t = await getTranslations({ locale });
  return pageMetadata({
    locale,
    path: placeHref(place.slug),
    title: t(place.nameKey),
    description: t(`placesPage.teaser.${place.slug}`),
    image: place.hero,
  });
}

// /sites/<slug>: one holy place. Hero, story with a "plan your visit" card, photo gallery
// with a full-screen viewer, and cards for the other places and the tour.
export default async function PlacePage({ params }: PageProps<'/[locale]/sites/[slug]'>) {
  const { locale, slug } = await params;
  const place = getPlace(slug);
  if (!place) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();

  const name = t(place.nameKey);
  const count = place.photos.length;
  const jsonLd = [
    placeJsonLd(place, { locale, name, description: t(`placesPage.teaser.${place.slug}`) }),
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('site.nav.sites'), path: '/sites' },
      { name, path: placeHref(place.slug) },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero image={place.hero} focus={place.heroFocus} eyebrow={t('placesPage.allSites')} eyebrowHref="/sites" title={name}>
        <ExternalLink
          href={place.mapUrl}
          className="ui-btn ui-btn--gold"
          icon={<PinIcon size={18} />}
          newTabLabel={t('placesPage.newTab')}
        >
          {t('headerGreek.mapButton')}
        </ExternalLink>
        <a className="ui-btn ui-btn--glass" href="#place-gallery">
          <PhotosIcon size={18} />
          {t('placesPage.viewGallery')}
          <span className={styles.count}>{count}</span>
        </a>
      </PlaceHero>

      <section className={`ui-section ${styles.story}`} aria-labelledby="place-story-title">
        <div className={`ui-container ${styles.storyGrid}`}>
          <Reveal>
            <p className="ui-eyebrow">{t('home.storyEyebrow')}</p>
            <h2 id="place-story-title" className="ui-h2">
              {t(place.titleKey)}
            </h2>
            <PlaceStory story={place.story} />
            <PageTools title={name} />
          </Reveal>
          <VisitCard place={place} />
        </div>
      </section>

      <section id="place-gallery" className={`ui-section ${styles.gallery}`} aria-labelledby="place-gallery-title">
        <div className="ui-container">
          <Reveal as="header" className={styles.head}>
            <p className="ui-eyebrow">{t('placesPage.galleryEyebrow')}</p>
            <h2 id="place-gallery-title" className="ui-h2">
              {t('placesPage.galleryTitle')}
            </h2>
            <p className="ui-muted">
              {t('placesPage.photoCount', { count })} · {t('placesPage.galleryHint')}
            </p>
          </Reveal>
          <PlaceGallery photos={place.photos} name={name} />
        </div>
      </section>

      <section className="ui-section" aria-labelledby="place-more-title">
        <div className="ui-container">
          <Reveal as="header" className={styles.head}>
            <p className="ui-eyebrow">{t('placesPage.moreEyebrow')}</p>
            <h2 id="place-more-title" className="ui-h2">
              {t('home.sitesTitle')}
            </h2>
          </Reveal>
          <PlaceCards cards={placeCards({ exclude: place.slug, withTour: true })} />
        </div>
      </section>
    </div>
  );
}
