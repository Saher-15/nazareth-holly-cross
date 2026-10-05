import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: require('./translation/en.json'), // Ensure path is correct
      },
      fr: {
        translation: require('./translation/fr.json'), // Ensure path is correct
      },
      es: {
        translation: require('./translation/es.json'), // Ensure path is correct
      },
      ru: {
        translation: require('./translation/ru.json'), // Ensure path is correct
      },
      pt: {
        translation: require('./translation/pt.json'), // Ensure path is correct
      },
      it: {
        translation: require('./translation/it.json'), // Ensure path is correct
      },
      pl: {
        translation: require('./translation/pl.json'), // Ensure path is correct
      },
      de: {
        translation: require('./translation/de.json'), // Ensure path is correct
      }
    },
    lng: 'en', // Default language
    fallbackLng: 'en', // Fallback language
    interpolation: {
      escapeValue: false, // React already safeguards from XSS
    },
  });

export default i18n;
