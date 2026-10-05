import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHero from '@/components/ui/PageHero';
import RetryButton from '@/components/shop/RetryButton';
import ShopBrowser from '@/components/shop/ShopBrowser';
import StateCard from '@/components/shop/StateCard';
import type { ShopItem } from '@/components/shop/catalog';
import { jsonLdHtml, localeAlternates, shopJsonLd } from '@/components/shop/seo';
import { fetchProducts } from '@/components/shop/products';
import type { Product } from '@/lib/api';
import { formatUsd } from '@/lib/pricing';
import styles from '../shop.module.css';

// The catalogue is rendered on the server and refreshed every 5 minutes (ISR).
export const revalidate = 300;

const HERO_IMAGE = '/images/vitrage-bg.jpg';

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
      images: [{ url: HERO_IMAGE, width: 612, height: 408, alt: title }],
    },
  };
}

async function loadProducts(): Promise<Product[] | null> {
  try {
    return await fetchProducts();
  } catch (error) {
    console.error('[shop] could not load the products', error);
    return null;
  }
}

export default async function ShopPage({ params }: PageProps<'/[locale]/shop'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tHome, products] = await Promise.all([
    getTranslations('shopPage'),
    getTranslations('home'),
    loadProducts(),
  ]);

  // Only what the grid needs goes to the browser; prices are formatted here so the
  // server and the browser can never disagree about them.
  const items: ShopItem[] | null =
    products?.map((p) => ({
      _id: p._id,
      name: p.name,
      description: p.description,
      price: p.price,
      priceLabel: formatUsd(p.price, locale),
      img: p.img,
      rate: p.rate,
    })) ?? null;

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
      <PageHero eyebrow={tHome('shopEyebrow')} title={t('heroTitle')} lead={t('heroLead')} image={HERO_IMAGE} />

      {items ? (
        <ShopBrowser products={items} />
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
