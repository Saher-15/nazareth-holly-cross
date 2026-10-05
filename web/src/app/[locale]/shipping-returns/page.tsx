import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import LegalDocument from '@/components/pilgrim/LegalDocument';

export async function generateMetadata({ params }: PageProps<'/[locale]/shipping-returns'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'legal.shipping', '/shipping-returns');
}

// /shipping-returns: the flat shipping fee, the automatic discount, delivery, customs and what to do about a
// damaged or wrong item. The return window is the owner's decision (see docs/TODO-LEGAL.md).
export default async function ShippingReturnsPage({ params }: PageProps<'/[locale]/shipping-returns'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocument page="shipping" locale={locale} />;
}
