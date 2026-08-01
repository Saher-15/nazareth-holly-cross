import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './translation/en.json';
import fr from './translation/fr.json';
import es from './translation/es.json';
import de from './translation/de.json';
import ru from './translation/ru.json';
import pt from './translation/pt.json';
import it from './translation/it.json';
import pl from './translation/pl.json';
import el from './translation/el.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      de: { translation: de },
      ru: { translation: ru },
      pt: { translation: pt },
      it: { translation: it },
      pl: { translation: pl },
      el: { translation: el },
    },
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'nhc-language',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
