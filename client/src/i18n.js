import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './translation/en.json';

export const LANGUAGES = ['en', 'fr', 'es', 'de', 'ru', 'pt', 'it', 'pl'];

// English ships in the main bundle (it is also the fallback); every other language is
// downloaded the first time it is chosen.
i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already safeguards from XSS
    },
  });

export async function changeLanguage(lng) {
  if (!LANGUAGES.includes(lng)) return;
  if (!i18n.hasResourceBundle(lng, 'translation')) {
    const bundle = await import(`./translation/${lng}.json`);
    i18n.addResourceBundle(lng, 'translation', bundle.default || bundle);
  }
  await i18n.changeLanguage(lng);
}

export default i18n;
