import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHero from '@/components/ui/PageHero';
import { mediaPhoto } from '@/data/places/places';
import RetryButton from '@/components/shop/RetryButton';
import ShopBrowser from '@/components/shop/ShopBrowser';
import StateCard from '@/components/shop/StateCard';
import { jsonLdHtml, localeAlternates, shopJsonLd } from '@/components/shop/seo';
import { pickStrip, shopItems } from '@/lib/shop/items';
import { loadBestSellers, loadCatalog } from '@/lib/shop/load';
import { sortProducts } from '@/lib/shop/query';
import styles from '../shop.module.css';

// The catalogue is rendered on the server and refreshed every two minutes (ISR).
export const revalidate = 120;

const HERO = mediaPhoto('souk-arcade');

export async function generateMetadata({ params }: PageProps<'/[locale]/shop'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shopPage.meta' });
  const title = t('shopTitle');
  const description = t('shopDescription');
  return {
    title,
    description,
    alternates: localeAlternates(locale, '/shop'),
    openGraph: {
      type: 'website',
      siteName: 'Nazareth Holy Cross',
      title,
      description,
      locale,
      url: `/${locale}/shop`,
      images: [{ url: HERO.src, width: HERO.width, height: HERO.height, alt: title }],
    },
  };
}

export default async function ShopPage({ params }: PageProps<'/[locale]/shop'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tHome, catalog, bestSellers] = await Promise.all([
    getTranslations('shopPage'),
    getTranslations('home'),
    loadCatalog(),
    loadBestSellers(),
  ]);

  // Only what the grid and the filters need goes to the browser.
  const items = catalog ? sortProducts(shopItems(catalog.products, locale), 'featured', locale) : null;
  const strip = items ? pickStrip(items, bestSellers) : null;

  return (
    <div className={`ui-page ${styles.page}`}>
      {items && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdHtml(
              shopJsonLd(items, locale, { title: t('meta.shopTitle'), description: t('meta.shopDescription') }),
            ),
          }}
        />
      )}
      <PageHero eyebrow={tHome('shopEyebrow')} title={t('heroTitle')} lead={t('heroLead')} media={HERO.media} />

      {items && strip ? (
        <ShopBrowser products={items} strip={strip} />
      ) : (
        <div className="ui-container">
          <StateCard icon="alert" tone="error" title={t('loadError')} text={t('loadErrorText')} role="alert">
            <RetryButton />
          </StateCard>
        </div>
      )}
    </div>
  );
}
