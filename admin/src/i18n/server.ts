import { cache } from 'react';
import { cookies } from 'next/headers';
import { dirOf, LOCALE_COOKIE, resolveLocale, type Locale } from './locales';
import { translatorFor, type Translate } from './translate';

export type ServerI18n = { locale: Locale; dir: 'ltr' | 'rtl'; t: Translate };

/** Locale of this request (cookie set by the language switcher; English by default). */
export const getI18n = cache(async (): Promise<ServerI18n> => {
  const jar = await cookies();
  const locale = resolveLocale(jar.get(LOCALE_COOKIE)?.value);
  return { locale, dir: dirOf(locale), t: translatorFor(locale) };
});
