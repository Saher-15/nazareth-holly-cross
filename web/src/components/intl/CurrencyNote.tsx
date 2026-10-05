import { useLocale, useTranslations } from 'next-intl';
import { approximateIn, formatCurrency } from '@/lib/currency';
import { SHIPPING_FEE, formatUsd } from '@/lib/pricing';
import styles from './CurrencyNote.module.css';

type Props = {
  /** The US-dollar amount the hint is for (the total shown above the note). */
  amountUsd?: number;
  /** Add the flat shipping fee line (orders only; candles and donations are not shipped). */
  shipping?: boolean;
};

// Under a total: everything is charged in US dollars, an approximate amount in the visitor's own currency
// when the language points to one (no exchange-rate service: see lib/currency.ts), and the shipping fee.
export default function CurrencyNote({ amountUsd, shipping = false }: Props) {
  const t = useTranslations('intl.currencyNote');
  const locale = useLocale();
  const hint = amountUsd === undefined ? null : approximateIn(amountUsd, locale);

  return (
    <div className={styles.note} data-testid="currency-note">
      {hint && (
        <p className={styles.approx} data-testid="currency-approx">
          {t('approx', { amount: formatCurrency(hint.amount, hint.currency, locale) })}
        </p>
      )}
      <p>{t('usd')}</p>
      {shipping && <p>{t('shipping', { fee: formatUsd(SHIPPING_FEE, locale) })}</p>}
    </div>
  );
}
