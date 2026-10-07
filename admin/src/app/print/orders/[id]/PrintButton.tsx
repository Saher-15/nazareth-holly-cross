'use client';

import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';

/** Opens the browser's print dialog (the slip has its own print stylesheet: admin.css "packing slip"). */
export function PrintButton() {
  const { t } = useI18n();
  return (
    <button type="button" className="btn btn--gold btn--sm" onClick={() => window.print()} data-testid="slip-print">
      <Icon name="orders" size={16} />
      <span>{t('slip.print')}</span>
    </button>
  );
}
