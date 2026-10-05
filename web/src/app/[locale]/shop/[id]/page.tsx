import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import ProductDetail from '@/components/shop/ProductDetail';
import RetryButton from '@/components/shop/RetryButton';
import { fetchProducts } from '@/components/shop/products';
import ShopIcon from '@/components/shop/ShopIcon';
import StateCard from '@/components/shop/StateCard';
import { jsonLdHtml, localeAlternates, productJsonLd, summarize } from '@/components/shop/seo';
import { formatUsd } from '@/lib/pricing';
import { loadProduct } from './load-product';
import TopBar from './TopBar';
import styles from '../shop.module.css';

// Product pages are built ahead for every product and refreshed every 5 minutes;
// a product added later is rendered on its first visit.
export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const products = await fetchProducts();
    return products.map((p) => ({ id: p._id }));
  } catch {
    return []; // API unreachable at build time: every product renders on demand instead
  }
}

export async function generateMetadata({ params }: PageProps<'/[locale]/shop/[id]'>): Promise<Metadata> {
  const { locale, id } = await params;
  const [result, t, tProduct] = await Promise.all([
    loadProduct(id),
    getTranslations({ locale, namespace: 'shopPage' }),
    getTranslations({ locale, namespace: 'product' }),
  ]);
  if (result.status !== 'ok') {
    return {
      title: result.status === 'notFound' ? tProduct('error.productNotFound') : t('productError'),
      robots: { index: false },
    };
  }

  const { product } = result;
  const description = summarize(product.description || t('meta.productDescription', { name: product.name }));
  return {
    title: product.name,
    description,
    alternates: localeAlternates(locale, `/shop/${product._id}`),
    openGraph: {
      type: 'website',
      siteName: 'Nazareth Holy Cross',
      title: product.name,
      description,
      locale,
      url: `/${locale}/shop/${product._id}`,
      images: [{ url: product.img, alt: product.name }],
    },
    twitter: { card: 'summary_large_image', title: product.name, description, images: [product.img] },
  };
}

export default async function ProductPage({ params }: PageProps<'/[locale]/shop/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const result = await loadProduct(id);
  if (result.status === 'notFound') notFound();

  const [t, tHome, tProduct, tCart] = await Promise.all([
    getTranslations('shopPage'),
    getTranslations('home'),
    getTranslations('product'),
    getTranslations('cart'),
  ]);

  if (result.status === 'error') {
    return (
      <div className={`ui-page ${styles.page}`}>
        <TopBar />
        <div className="ui-container">
          <StateCard
            icon="alert"
            tone="error"
            headingLevel={1}
            title={t('productError')}
            text={t('loadErrorText')}
            role="alert"
          >
            <RetryButton />
            <Link href="/shop" className="ui-btn ui-btn--ghost">
              {tCart('backToShopping')}
            </Link>
          </StateCard>
        </div>
      </div>
    );
  }

  const { product } = result;
  const stockState = product.stock === null ? null : product.stock > 0 ? 'in' : 'out';

  const header = (
    <>
      <p className="ui-eyebrow">{tHome('shopEyebrow')}</p>
      <h1 className={styles.title}>
        <bdi>{product.name}</bdi>
      </h1>
      <p className={styles.price} data-testid="product-price">
        {formatUsd(product.price, locale)}
      </p>
      {stockState && product.stock !== null && (
        <p className={styles.stock} data-state={stockState}>
          {stockState === 'out'
            ? t('outOfStock')
            : product.stock <= 5
              ? t('lowStock', { count: product.stock })
              : t('inStock')}
        </p>
      )}
      {product.description && (
        <p className={styles.desc}>
          <bdi>{product.description}</bdi>
        </p>
      )}
    </>
  );

  const footer = (
    <p className={styles.note}>
      <ShopIcon name="truck" className={styles.noteIcon} />
      <span>{tProduct('note.shippingFee')}</span>
    </p>
  );

  return (
    <div className={`ui-page ${styles.page}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(productJsonLd(product, locale)) }}
      />
      <TopBar />
      <article className={`ui-container ${styles.product}`}>
        <ProductDetail
          product={{
            _id: product._id,
            name: product.name,
            price: product.price,
            img: product.img,
            additionalImageUrls: product.additionalImageUrls,
            color: product.color,
            stock: product.stock,
          }}
          header={header}
          footer={footer}
        />
      </article>
    </div>
  );
}
