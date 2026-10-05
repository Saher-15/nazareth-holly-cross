'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { isApiError } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { useI18n } from '@/i18n/client';
import { useFeedback } from './Feedback';
import { Icon, type IconName } from './Icon';

// One button for every row action (mark shipped, mark done, hide/show, delete, disable...).
// It optionally asks for confirmation, calls the API through /api/proxy, shows a toast and refreshes the page data.

export type ApiActionProps = {
  label: string;
  /** Accessible name when the label is just an icon or too short on its own (e.g. includes the row name). */
  ariaLabel?: string;
  icon?: IconName;
  method: 'PATCH' | 'DELETE' | 'POST' | 'PUT';
  path: string;
  body?: unknown;
  successText: string;
  tone?: 'default' | 'gold' | 'danger';
  confirm?: { title: string; message?: string; confirmLabel?: string; tone?: 'danger' | 'primary' };
  /** Where to go afterwards instead of refreshing in place (e.g. leave a detail drawer after a delete). */
  then?: string;
  iconOnly?: boolean;
  disabled?: boolean;
  testId?: string;
};

export function ApiAction({ label, ariaLabel, icon, method, path, body, successText, tone = 'default', confirm, then, iconOnly, disabled, testId }: ApiActionProps) {
  const router = useRouter();
  const { toast, confirm: ask } = useFeedback();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (confirm && !(await ask(confirm))) return;
    setBusy(true);
    try {
      await proxyCall({ method, path, body });
      toast(successText, 'success');
      if (then) router.replace(then);
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.unauthorized) return;
      toast(isApiError(error) && error.status < 500 && error.status !== 429 ? error.message : t('error.generic'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const className = iconOnly
    ? `icon-btn ${tone === 'danger' ? 'icon-btn--danger' : ''}`
    : `btn btn--sm ${tone === 'gold' ? 'btn--gold' : tone === 'danger' ? 'btn--ghost-danger' : 'btn--ghost'}`;

  return (
    <button type="button" className={className} onClick={run} disabled={disabled || busy} aria-busy={busy || undefined} aria-label={ariaLabel ?? (iconOnly ? label : undefined)} title={iconOnly ? label : undefined} data-testid={testId}>
      {busy ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={16} /> : null}
      {iconOnly ? null : <span>{label}</span>}
    </button>
  );
}
