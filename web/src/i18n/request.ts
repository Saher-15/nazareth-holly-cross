import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

type Messages = { [key: string]: string | Messages };

// Missing keys in a translation fall back to the English text instead of breaking the page.
function withFallback(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = base[key];
    out[key] =
      typeof value === 'object' && typeof baseValue === 'object'
        ? withFallback(baseValue, value)
        : value;
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const english = (await import('../messages/en.json')).default as Messages;
  const messages =
    locale === 'en'
      ? english
      : withFallback(english, (await import(`../messages/${locale}.json`)).default as Messages);

  return { locale, messages };
});
