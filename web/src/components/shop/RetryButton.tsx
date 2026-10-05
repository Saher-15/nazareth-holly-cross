'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import ShopIcon from './ShopIcon';

// Asks the server for the page again (after an API failure) without a full reload.
// `onRetry` lets an error boundary pass its own retry() instead.
export default function RetryButton({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations('home');
  const tShop = useTranslations('shopPage');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="ui-btn ui-btn--gold"
      aria-busy={pending}
      onClick={() => startTransition(() => (onRetry ? onRetry() : router.refresh()))}
    >
      <ShopIcon name="reset" />
      {pending ? tShop('loading') : t('retry')}
    </button>
  );
}
