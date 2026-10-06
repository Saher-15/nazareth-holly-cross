'use client';

import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';

// Anything a page did not handle itself (a bug, not an API failure) ends here, with a way to try again.
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="state state--error" role="alert">
      <Icon name="alert" size={32} />
      <h1 className="state__title">{t('state.error')}</h1>
      <p className="state__text">{t('state.errorText')}</p>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => reset()}>
        {t('common.retry')}
      </button>
    </div>
  );
}
