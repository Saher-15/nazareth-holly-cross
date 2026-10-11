'use client';

import { useId, useState } from 'react';
import { useI18n } from '@/i18n/client';
import { formatMoney } from '@/lib/format';
import { costPerCustomer, parseAmount } from '@/lib/funnel';

// "What did one paying customer cost?": the owner types what was spent on advertising in the period shown and gets
// the cost per completed purchase. Nothing is saved or sent: it is a calculator next to the numbers.
export function CostPerCustomer({ customers }: { customers: number }) {
  const { t, locale } = useI18n();
  const id = useId();
  const [text, setText] = useState('');
  const empty = text.trim() === '';
  const spend = empty ? null : parseAmount(text);
  const cost = spend === null ? null : costPerCustomer(spend, customers);

  return (
    <div className="form">
      <div className="field">
        <label htmlFor={id}>{t('campaigns.spendLabel')}</label>
        <input id={id} className="input" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} maxLength={10} dir="ltr" aria-describedby={`${id}-h`} data-testid="ad-spend" />
        <p id={`${id}-h`} className="hint">{t('campaigns.spendHint')}</p>
      </div>
      <p role="status" aria-live="polite" data-testid="cost-per-customer">
        {empty
          ? t('campaigns.costEmpty')
          : spend === null
            ? t('campaigns.costInvalid')
            : cost === null
            ? t('campaigns.costNoCustomers')
            : t('campaigns.costResult', { cost: formatMoney(cost, locale), n: customers })}
      </p>
    </div>
  );
}
