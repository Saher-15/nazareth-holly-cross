import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHero from '@/components/ui/PageHero';
import { mediaPhoto } from '@/data/places/places';
import CartView from '@/components/shop/CartView';
import { pageMetadata } from '@/lib/seo';
import styles from './cart.module.css';

export async function generateMetadata({ params }: PageProps<'/[locale]/cart'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shopPage.meta' });
  // A cart is personal: keep it out of search results, but let crawlers follow its links.
  return pageMetadata({
    locale,
    path: '/cart',
    title: t('cartTitle'), description: t('cartDescription'),
    image: mediaPhoto('souk-arcade'),
    noindex: true,
  });
}

// The page shell is static; the cart itself is read from the browser by <CartView />.
export default async function CartPage({ params }: PageProps<'/[locale]/cart'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tHome] = await Promise.all([getTranslations('shopPage'), getTranslations('home')]);

  return (
    <div className={`ui-page ${styles.page}`}>
      <PageHero eyebrow={tHome('shopEyebrow')} title={t('cartTitle')} />
      <CartView />
    </div>
  );
}
