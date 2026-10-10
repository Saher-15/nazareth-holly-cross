'use client';

import { useLocale, useTranslations } from 'next-intl';
import Notice from '@/components/ui/Notice';

/**
 * After a submit attempt with problems: one alert that names the fields to fix, in screen order and in the visitor's
 * language ("Please check these fields: First name, Email and Country."), instead of "the highlighted fields", which
 * only describes something visual (WCAG 3.3.1, 4.1.3). Each field also has its own error text, linked to it.
 */
export default function ErrorSummary({ fields }: { fields: string[] }) {
  const t = useTranslations('checkoutPage.form');
  const locale = useLocale();
  if (!fields.length) return null;
  // A label may end in a colon ("Select the church:"), which does not belong inside a list.
  const names = fields.map((field) => field.replace(/[\s:：]+$/u, ''));
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);
  return (
    <Notice role="alert">
      <span data-testid="error-summary">{t('errorSummary', { fields: list })}</span>
    </Notice>
  );
}
