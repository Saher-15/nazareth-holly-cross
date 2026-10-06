'use client';

import { signOut } from '@/components/shell/IdleGuard';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';

export function SignOutEverywhere() {
  const { t } = useI18n();
  return (
    <button type="button" className="btn btn--ghost" onClick={() => void signOut('manual')}>
      <Icon name="logout" size={18} />
      <span>{t('shell.signOut')}</span>
    </button>
  );
}
