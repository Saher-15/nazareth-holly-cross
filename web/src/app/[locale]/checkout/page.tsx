import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHero from '@/components/ui/PageHero';
import { flowMetadata } from '@/components/checkout/metadata';
import shared from '@/components/checkout/checkout.module.css';
import CheckoutFlow from './CheckoutFlow';

export async function generateMetadata({ params }: PageProps<'/[locale]/checkout'>): Promise<Metadata> {
  const { locale } = await params;
  return flowMetadata(locale, 'checkout', { index: false });
}

// Shop checkout. The steps run in the browser (CheckoutFlow) because the cart lives there.
export default async function CheckoutPage({ params }: PageProps<'/[locale]/checkout'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('checkoutPage.hero');

  return (
    <div className={`ui-page ${shared.page} ${shared.plain}`}>
      <PageHero eyebrow={t('eyebrow')} title={t('orderTitle')} lead={t('lead')} />
      <div className="ui-container">
        <CheckoutFlow />
      </div>
    </div>
  );
}
