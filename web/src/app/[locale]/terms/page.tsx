import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import LegalDocument from '@/components/pilgrim/LegalDocument';

export async function generateMetadata({ params }: PageProps<'/[locale]/terms'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'legal.terms', '/terms');
}

// /terms: the terms of using the site, ordering, lighting candles and donating. Marked for legal review in
// docs/TODO-LEGAL.md.
export default async function TermsPage({ params }: PageProps<'/[locale]/terms'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocument page="terms" locale={locale} />;
}
