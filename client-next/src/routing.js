import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'fr', 'es', 'de', 'ru', 'pt', 'it', 'pl', 'el'],
  defaultLocale: 'en',
});
