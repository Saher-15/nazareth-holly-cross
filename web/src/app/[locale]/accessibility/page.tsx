import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { pilgrimMetadata } from '@/data/pilgrim/meta';
import LegalDocument from '@/components/pilgrim/LegalDocument';

export async function generateMetadata({ params }: PageProps<'/[locale]/accessibility'>): Promise<Metadata> {
  const { locale } = await params;
  return pilgrimMetadata(locale, 'legal.accessibility', '/accessibility');
}

// /accessibility: the accessibility statement (Israeli Standard IS 5568, WCAG 2.2 AA): the level we claim and why,
// the accessibility settings, what was done, the known limitations, how the site is tested and how to reach the
// accessibility coordinator. The evidence behind it is docs/ACCESSIBILITY.md; keep the two in step.
export default async function AccessibilityPage({ params }: PageProps<'/[locale]/accessibility'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocument page="accessibility" locale={locale} />;
}
