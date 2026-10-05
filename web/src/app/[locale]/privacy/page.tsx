import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import LegalDocument from '@/components/pilgrim/LegalDocument';

export async function generateMetadata({ params }: PageProps<'/[locale]/privacy'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'legal.privacy', '/privacy');
}

// /privacy: what data the site keeps and why (facts from the code: orders, candles, prayers, reviews, contact
// messages; the cart and wishlist stay in the browser). Marked for legal review in docs/TODO-LEGAL.md.
export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocument page="privacy" locale={locale} />;
}
