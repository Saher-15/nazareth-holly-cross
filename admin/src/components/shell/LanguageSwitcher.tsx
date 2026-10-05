'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, isLocale } from '@/i18n/locales';

// The language is a harmless preference (no secrets), kept in a plain cookie so server components can render in it.
export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();

  function change(value: string) {
    if (!isLocale(value)) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Strict`;
    router.refresh();
  }

  return (
    <div className="lang">
      <label className="visually-hidden" htmlFor="lang-select">{t('shell.language')}</label>
      <select id="lang-select" className="select select--compact" value={locale} onChange={(event) => change(event.target.value)}>
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>{LOCALE_NAMES[code]}</option>
        ))}
      </select>
    </div>
  );
}
