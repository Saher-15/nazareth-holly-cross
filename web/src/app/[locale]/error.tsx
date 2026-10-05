'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import PageHero from '@/components/ui/PageHero';

// Last-resort boundary for every page of a language (the shop has its own, closer one). The header
// and footer stay, the visitor can try again or go home. Uses messages that already exist in all languages.
export default function LocaleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="ui-page" role="alert">
      <PageHero eyebrow="500" title={t('communityPage.reviews.form.errors.server')}>
        <p style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="ui-btn ui-btn--gold" onClick={() => retry()}>
            {t('home.retry')}
          </button>
          <Link href="/" className="ui-btn ui-btn--ghost">
            {t('site.notFound.backHome')}
          </Link>
        </p>
      </PageHero>
    </div>
  );
}
