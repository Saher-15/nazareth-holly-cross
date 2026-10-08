'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n/client';
import { isApiError } from '@/lib/api';
import { proxyCall } from '@/lib/client-api';
import { parsePrice, siteSettingsSchema, type SiteSettings } from '@/lib/settings';

/** The candle price customers are charged. Every admin sees it; only an owner can change it (the API checks too). */
export function CandlePriceForm({ settings, canEdit }: { settings: SiteSettings; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const { toast } = useFeedback();
  const router = useRouter();
  const uid = useId();
  const [text, setText] = useState(settings.candlePrice.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const price = parsePrice(text);
    if (price === null || price < settings.candlePriceMin || price > settings.candlePriceMax) {
      return setError(t('pricing.candlePriceInvalid', { min: money(settings.candlePriceMin), max: money(settings.candlePriceMax) }));
    }
    if (price === settings.candlePrice) return setError(t('pricing.candlePriceSame'));
    setBusy(true);
    setError(null);
    try {
      await proxyCall({ method: 'PUT', path: 'settings/candle-price', body: { price }, schema: siteSettingsSchema });
      toast(t('pricing.candlePriceSaved', { price: money(price) }), 'success');
      router.refresh();
    } catch (e) {
      if (isApiError(e) && e.unauthorized) return;
      setError(isApiError(e) && e.status === 403 ? t('pricing.candlePriceOwnerOnly') : t('pricing.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <p className="hint">{t('pricing.candlePriceLead')}</p>
      <p>
        <strong>{t('pricing.candlePriceNow', { price: money(settings.candlePrice) })}</strong>
        {settings.updatedAt ? (
          <span className="hint"> · {t('pricing.candlePriceChanged', { who: settings.updatedBy || '—', when: new Date(settings.updatedAt).toLocaleString(locale) })}</span>
        ) : null}
      </p>
      {canEdit ? (
        <form className="form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor={`${uid}-price`}>{t('pricing.candlePriceLabel')}</label>
            <input id={`${uid}-price`} className="input" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} dir="ltr" aria-describedby={`${uid}-help`} required />
            <p id={`${uid}-help`} className="hint">{t('pricing.candlePriceHelp', { min: money(settings.candlePriceMin), max: money(settings.candlePriceMax) })}</p>
          </div>
          <div className="form__error" role="alert" aria-live="assertive">
            {error ? (<><Icon name="alert" size={18} /><span>{error}</span></>) : null}
          </div>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? t('pricing.saving') : t('pricing.candlePriceSave')}</button>
        </form>
      ) : (
        <p className="hint">{t('pricing.candlePriceOwnerOnly')}</p>
      )}
    </div>
  );
}
