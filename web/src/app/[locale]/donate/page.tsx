import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PageHero from '@/components/ui/PageHero';
import { flowMetadata } from '@/components/checkout/metadata';
import shared from '@/components/checkout/checkout.module.css';
import DonateFlow from './DonateFlow';

export async function generateMetadata({ params }: PageProps<'/[locale]/donate'>): Promise<Metadata> {
  const { locale } = await params;
  return flowMetadata(locale, 'donate');
}

// Donation: the visitor chooses the amount (1–5000 USD) and pays with PayPal.
export default async function DonatePage({ params }: PageProps<'/[locale]/donate'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('checkoutPage.hero');

  return (
    <div className={`ui-page ${shared.page} ${shared.plain}`}>
      <PageHero eyebrow={t('donateEyebrow')} title={t('donateTitle')} lead={t('donateLead')} />
      <div className="ui-container">
        <DonateFlow />
      </div>
    </div>
  );
}
