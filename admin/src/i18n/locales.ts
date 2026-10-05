export const LOCALES = ['en', 'he', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'nhc_admin_lang';

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', he: 'עברית', ar: 'العربية' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function dirOf(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'he' || locale === 'ar' ? 'rtl' : 'ltr';
}
