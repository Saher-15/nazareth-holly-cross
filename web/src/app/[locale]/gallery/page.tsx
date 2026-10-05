import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PLACES, photo } from '@/data/places/places';
import { absoluteUrl, breadcrumbJsonLd } from '@/data/places/seo';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import { webPageJsonLd } from '@/data/pilgrim/seo';
import JsonLd from '@/components/places/JsonLd';
import PlaceHero from '@/components/places/PlaceHero';
import GalleryBrowser, { type GalleryFilter, type GalleryItem } from '@/components/pilgrim/GalleryBrowser';
import NextSteps from '@/components/pilgrim/NextSteps';

const HERO = photo('latin', 1);

export async function generateMetadata({ params }: PageProps<'/[locale]/gallery'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'gallery', '/gallery', HERO);
}

// /gallery: every photo of the five holy sites, in one masonry grid with a filter by site and a lightbox.
export default async function GalleryPage({ params }: PageProps<'/[locale]/gallery'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const items: GalleryItem[] = PLACES.flatMap((place) =>
    place.photos.map((p, i) => ({ photo: p, slug: place.slug, name: t(place.nameKey), n: i + 1, total: place.photos.length })),
  );
  const filters: GalleryFilter[] = PLACES.map((place) => ({
    slug: place.slug,
    name: t(place.nameKey),
    count: place.photos.length,
  }));

  const jsonLd = [
    webPageJsonLd(locale, {
      type: 'ImageGallery',
      path: '/gallery',
      name: t('pilgrim.gallery.meta.title'),
      description: t('pilgrim.gallery.meta.description'),
      extra: {
        image: PLACES.map((place) => ({
          '@type': 'ImageObject',
          contentUrl: absoluteUrl(place.cover.src),
          name: t(place.nameKey),
          width: place.cover.width,
          height: place.cover.height,
        })),
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
      />

      <section className="ui-section" aria-label={t('pilgrim.gallery.hero.title')}>
        <div className="ui-container">
          <GalleryBrowser items={items} filters={filters} />
        </div>
      </section>

      <NextSteps pages={['plan', 'gospel', 'visit']} />
    </div>
  );
}
