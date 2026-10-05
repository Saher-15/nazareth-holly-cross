import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import JsonLd from '@/components/community/JsonLd';
import ReviewForm from '@/components/community/ReviewForm';
import ReviewWall from '@/components/community/ReviewWall';
import { communityMetadata } from '@/components/community/metadata';
import PageHero from '@/components/ui/PageHero';
import Reveal from '@/components/ui/Reveal';
import { api, type Review } from '@/lib/api';
import { SITE_URL } from '@/lib/config';
import styles from './page.module.css';

// The wall is rebuilt at most every two minutes (the same as api.reviews), and at once after a visitor's
// review is accepted (components/community/actions.ts).
export const revalidate = 120;

const HERO_IMAGE = '/images/vitrage-bg.jpg';

export async function generateMetadata({ params }: PageProps<'/[locale]/reviews'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'communityPage.reviews' });
  const site = await getTranslations({ locale, namespace: 'site' });
  return communityMetadata({
    locale,
    path: '/reviews',
    title: t('metaTitle'),
    description: t('metaDescription'),
    siteName: site('name'),
    image: HERO_IMAGE,
  });
}

/** Approved reviews, newest first; null when the API cannot be reached (the page then says so). */
async function loadReviews(): Promise<Review[] | null> {
  try {
    return await api.reviews();
  } catch (error) {
    console.error('[reviews] could not load the approved reviews:', error);
    return null;
  }
}

export default async function ReviewsPage({ params }: PageProps<'/[locale]/reviews'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [home, pray, site, reviews] = await Promise.all([
    getTranslations('home'),
    getTranslations('pray'),
    getTranslations('site'),
    loadReviews(),
  ]);

  const jsonLd = reviews?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: site('name'),
        url: SITE_URL,
        review: reviews.slice(0, 20).map((review) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: review.fullName },
          reviewBody: review.msg,
          ...(review.createdAt ? { datePublished: review.createdAt.slice(0, 10) } : {}),
        })),
      }
    : null;

  return (
    <div className={`ui-page ${styles.page}`}>
      <PageHero
        eyebrow={home('voicesEyebrow')}
        title={home('voicesTitle')}
        lead={pray('messagesDescription')}
        image={HERO_IMAGE}
      />

      <div className={`ui-container ${styles.layout}`}>
        <div className={styles.aside}>
          <Reveal>
            <ReviewForm titleId="review-form-title" />
          </Reveal>
        </div>
        <ReviewWall reviews={reviews} titleId="review-wall-title" />
      </div>

      {jsonLd && <JsonLd data={jsonLd} />}
    </div>
  );
}
