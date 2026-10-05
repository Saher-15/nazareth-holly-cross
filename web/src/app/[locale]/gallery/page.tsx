import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { MEDIA, MEDIA_TOPICS, mediaByTopic } from '@/data/media';
import { PLACE_OF_TOPIC, mediaPhoto, placeHref } from '@/data/places/places';
import { absoluteUrl, breadcrumbJsonLd, itemListJsonLd, localePath, pageMetadata } from '@/data/places/seo';
import JsonLd from '@/components/places/JsonLd';
import PlaceGallery from '@/components/places/PlaceGallery';
import PlaceHero from '@/components/places/PlaceHero';
import { ArrowIcon } from '@/components/places/icons';
import Reveal from '@/components/ui/Reveal';
import styles from './page.module.css';

const HERO = 'basilica-night-view';

export async function generateMetadata({ params }: PageProps<'/[locale]/gallery'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'media.meta' });
  return pageMetadata({
    locale,
    path: '/gallery',
    title: t('galleryTitle'),
    description: t('galleryDescription'),
    image: mediaPhoto(HERO),
  });
}

// /gallery: Nazareth in pictures. Every licensed photograph, grouped by what it shows, each group a gallery
// with the full-screen viewer (which names the photographer and the licence). Credits are listed on /credits.
export default async function GalleryPage({ params }: PageProps<'/[locale]/gallery'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tm = await getTranslations('media');

  const topics = MEDIA_TOPICS.filter((topic) => mediaByTopic(topic).length > 0);
  const jsonLd = [
    itemListJsonLd(
      locale,
      tm('meta.galleryTitle'),
      topics.map((topic) => ({ name: tm(`topic.${topic}`), path: `/gallery#gallery-${topic}` })),
    ),
    {
      '@context': 'https://schema.org',
      '@type': 'ImageGallery',
      name: tm('meta.galleryTitle'),
      url: absoluteUrl(localePath(locale, '/gallery')),
      inLanguage: locale,
      numberOfItems: MEDIA.length,
    },
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: tm('gallery.title'), path: '/gallery' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero
        image={mediaPhoto(HERO)}
        size="medium"
        eyebrow={tm('gallery.eyebrow')}
        title={tm('gallery.title')}
        lead={tm('gallery.lead')}
      >
        <Link href="/sites" className="ui-btn ui-btn--gold">
          {t('home.explore')}
        </Link>
        <Link href="/credits" className="ui-btn ui-btn--glass">
          {tm('gallery.creditsLink')}
        </Link>
      </PlaceHero>

      {topics.map((topic) => {
        const photos = mediaByTopic(topic).map((item) => mediaPhoto(item.id));
        const place = PLACE_OF_TOPIC[topic];
        return (
          <section
            key={topic}
            id={`gallery-${topic}`}
            className={`ui-section ${styles.group}`}
            aria-labelledby={`gallery-${topic}-title`}
          >
            <div className="ui-container">
              <Reveal as="header" className={styles.head}>
                <p className="ui-eyebrow">{t('placesPage.photoCount', { count: photos.length })}</p>
                <h2 id={`gallery-${topic}-title`} className="ui-h2">
                  {tm(`topic.${topic}`)}
                </h2>
                <Link href={placeHref(place)} className={styles.more}>
                  {tm('gallery.visitPage')}
                  <ArrowIcon size={16} className={styles.arrow} />
                </Link>
              </Reveal>
              <PlaceGallery photos={photos} name={tm(`topic.${topic}`)} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
