import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import ProductDetail from '@/components/shop/ProductDetail';
import ProductReviews from '@/components/shop/ProductReviews';
import ProductRow from '@/components/shop/ProductRow';
import RecentlyViewed from '@/components/shop/RecentlyViewed';
import RetryButton from '@/components/shop/RetryButton';
import ShareButton from '@/components/shop/ShareButton';
import ShopIcon from '@/components/shop/ShopIcon';
import StateCard from '@/components/shop/StateCard';
import WishlistButton from '@/components/shop/WishlistButton';
import { jsonLdHtml, localeAlternates, productJsonLd, summarize } from '@/components/shop/seo';
import Stars from '@/components/ui/Stars';
import { formatUsd } from '@/lib/pricing';
import { bestSellerIds, cardItems, toCardItem } from '@/lib/shop/items';
import { loadCatalog, loadReviews, loadSimilar } from '@/lib/shop/load';
import { toSearch } from '@/lib/shop/query';
import { loadProduct } from './load-product';
import TopBar from './TopBar';
import styles from '../shop.module.css';

// Product pages are built ahead for every product and refreshed every 5 minutes;
// a product added later is rendered on its first visit.
export const revalidate = 300;

export async function generateStaticParams() {
  const catalog = await loadCatalog();
  // API unreachable at build time: every product renders on demand instead.
  return catalog?.products.map((p) => ({ id: p._id })) ?? [];
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

  const [t, tf, tHome, tProduct, tCart, format] = await Promise.all([
    getTranslations('shopPage'),
    getTranslations('shopFeatures'),
    getTranslations('home'),
    getTranslations('product'),
    getTranslations('cart'),
    getFormatter(),
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
  const [catalog, reviews, similar] = await Promise.all([
    loadCatalog(),
    loadReviews(product._id, product.rating ? product.rating.count : null),
    loadSimilar(product._id, 4),
  ]);

  // Cards for "similar" and "recently viewed" (recently viewed is resolved in the browser).
  const allCards = catalog ? cardItems(catalog.products, locale) : [];
  const bestSellers = bestSellerIds(catalog?.products ?? []);
  const similarCards = (similar ?? []).map((p) => toCardItem(p, { locale, bestSellers }));

  const rating = reviews?.summary ?? product.rating;
  const ratingText = rating ? format.number(rating.avg, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '';
  const stockState = product.stock === null ? null : product.stock > 0 ? 'in' : 'out';

  const header = (
    <>
      {product.category ? (
        <Link href={`/shop${toSearch({ category: product.category })}`} className={`ui-eyebrow ${styles.eyebrow}`}>
          {tf(`categories.${product.category}`)}
        </Link>
      ) : (
        <p className="ui-eyebrow">{tHome('shopEyebrow')}</p>
      )}
      <h1 className={styles.title}>
        <bdi>{product.name}</bdi>
      </h1>
      <p className={styles.ratingLine}>
        {rating && rating.count > 0 ? (
          <a href="#reviews" className={styles.ratingLink} data-testid="rating-summary">
            <Stars value={rating.avg} size="md" label={tf('reviews.starsLabel', { rating: ratingText })} />
            <span className={styles.ratingValue}>{ratingText}</span>
            <span>{tf('reviews.count', { count: rating.count })}</span>
          </a>
        ) : (
          <a href="#write-review" className={styles.ratingLink} data-testid="rating-summary">
            <ShopIcon name="pen" className={styles.ratingIcon} />
            <span>{tf('product.beFirst')}</span>
          </a>
        )}
      </p>
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
    <>
      <div className={styles.actions}>
        <WishlistButton id={product._id} name={product.name} variant="pill" />
        <ShareButton name={product.name} />
      </div>
      <p className={styles.note}>
        <ShopIcon name="truck" className={styles.noteIcon} />
        <span>{tProduct('note.shippingFee')}</span>
      </p>
    </>
  );

  return (
    <div className={`ui-page ${styles.page}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            productJsonLd(product, locale, rating ? { rating, reviews: reviews?.reviews } : undefined),
          ),
        }}
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
      <ProductReviews productId={product._id} productName={product.name} initial={reviews} />
      <ProductRow id="similar-title" title={tf('product.similarTitle')} items={similarCards} testId="similar-products" />
      <RecentlyViewed currentId={product._id} items={allCards} />
    </div>
  );
}
