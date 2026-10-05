import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { MEDIA, MEDIA_TOPICS, mediaByTopic, mediaShareFile } from '@/data/media';
import { PLACES, PLACE_OF_TOPIC, mediaPhoto, placeHref } from '@/data/places/places';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import JsonLd from '@/components/ui/JsonLd';
import PlaceHero from '@/components/places/PlaceHero';
import GalleryBrowser, { type GalleryFilter, type GalleryGroup } from '@/components/pilgrim/GalleryBrowser';
import NextSteps from '@/components/pilgrim/NextSteps';
import { breadcrumbJsonLd, webPageJsonLd } from '@/lib/jsonLd';
import { absoluteUrl } from '@/lib/seo';

const HERO = mediaPhoto('basilica-night-view');

export async function generateMetadata({ params }: PageProps<'/[locale]/gallery'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'gallery', '/gallery', HERO);
}

// /gallery: Nazareth in pictures. Every licensed photograph, grouped by what it shows (a group per topic), with
// a filter by holy site and the full-screen viewer, which names the photographer and the licence. The full
// list of credits is on /credits.
export default async function GalleryPage({ params }: PageProps<'/[locale]/gallery'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const groups: GalleryGroup[] = MEDIA_TOPICS.filter((topic) => mediaByTopic(topic).length > 0).map((topic) => ({
    topic,
    slug: PLACE_OF_TOPIC[topic],
    href: placeHref(PLACE_OF_TOPIC[topic]),
    photos: mediaByTopic(topic).map((item) => mediaPhoto(item.id)),
  }));
  const filters: GalleryFilter[] = PLACES.map((place) => ({
    slug: place.slug,
    name: t(place.nameKey),
    count: groups.filter((g) => g.slug === place.slug).reduce((sum, g) => sum + g.photos.length, 0),
  })).filter((f) => f.count > 0);

  const jsonLd = [
    webPageJsonLd(locale, {
      type: 'ImageGallery',
      path: '/gallery',
      name: t('pilgrim.gallery.meta.title'),
      description: t('pilgrim.gallery.meta.description'),
      extra: {
        numberOfItems: MEDIA.length,
        // One licensed photo per topic, with its author and licence, so search engines can show the credit.
        image: groups.map((group) => {
          const item = mediaByTopic(group.topic)[0];
          return {
            '@type': 'ImageObject',
            name: t(`media.topic.${group.topic}`),
            contentUrl: absoluteUrl(mediaShareFile(item)),
            creditText: item.credit,
            creator: { '@type': 'Person', name: item.author },
            license: item.licenseUrl || undefined,
            acquireLicensePage: item.sourceUrl,
          };
        }),
      },
    }),
    breadcrumbJsonLd(locale, [
      { name: t('site.nav.home'), path: '/' },
      { name: t('pilgrim.nav.gallery'), path: '/gallery' },
    ]),
  ];

  return (
    <div className="ui-page">
      <JsonLd data={jsonLd} />
      <PlaceHero
        image={HERO}
        size="medium"
        eyebrow={t('pilgrim.gallery.hero.eyebrow')}
        title={t('pilgrim.gallery.hero.title')}
        lead={t('pilgrim.gallery.hero.lead')}
      >
        <Link href="/sites" className="ui-btn ui-btn--gold">
          {t('home.explore')}
        </Link>
        <Link href="/credits" className="ui-btn ui-btn--glass">
          {t('media.gallery.creditsLink')}
        </Link>
      </PlaceHero>

      <section className="ui-section" aria-label={t('pilgrim.gallery.hero.title')}>
        <div className="ui-container">
          <GalleryBrowser groups={groups} filters={filters} />
        </div>
      </section>

      <NextSteps pages={['plan', 'gospel', 'visit']} />
    </div>
  );
}
