import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import RetryButton from '@/components/shop/RetryButton';
import StateCard from '@/components/shop/StateCard';
import WishlistView from '@/components/shop/WishlistView';
import { localeAlternates } from '@/components/shop/seo';
import PageHero from '@/components/ui/PageHero';
import { cardItems } from '@/lib/shop/items';
import { loadCatalog } from '@/lib/shop/load';
import styles from '../shop/shop.module.css';

// The page and the catalogue are rendered on the server (ISR); which products are saved
// is only known in the browser, so <WishlistView /> picks them out there.
export const revalidate = 120;

export async function generateMetadata({ params }: PageProps<'/[locale]/wishlist'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shopFeatures.wishlist' });
  const title = t('pageTitle');
  const description = t('pageDescription');
  return {
    title,
    description,
    alternates: localeAlternates(locale, '/wishlist'),
    // A wishlist is personal: keep it out of search results, but let crawlers follow its links.
    robots: { index: false, follow: true },
    openGraph: { type: 'website', siteName: 'Nazareth Holy Cross', title, description, locale, url: `/${locale}/wishlist` },
  };
}

export default async function WishlistPage({ params }: PageProps<'/[locale]/wishlist'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tShop, tHome, catalog] = await Promise.all([
    getTranslations('shopFeatures.wishlist'),
    getTranslations('shopPage'),
    getTranslations('home'),
    loadCatalog(),
  ]);

  return (
    <div className={`ui-page ${styles.page}`}>
      <PageHero eyebrow={tHome('shopEyebrow')} title={t('pageTitle')} lead={t('pageDescription')} />
      <section className="ui-container" aria-labelledby="wishlist-heading">
        <h2 id="wishlist-heading" className="visually-hidden">
          {t('savedHeading')}
        </h2>
        {catalog ? (
          <WishlistView items={cardItems(catalog.products, locale)} />
        ) : (
          <StateCard icon="alert" tone="error" title={tShop('loadError')} text={tShop('loadErrorText')} role="alert">
            <RetryButton />
          </StateCard>
        )}
      </section>
    </div>
  );
}
