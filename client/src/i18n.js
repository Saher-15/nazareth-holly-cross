import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './translation/en.json';
import fr from './translation/fr.json';
import es from './translation/es.json';
import ru from './translation/ru.json';
import pt from './translation/pt.json';
import it from './translation/it.json';
import pl from './translation/pl.json';
import de from './translation/de.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      ru: { translation: ru },
      pt: { translation: pt },
      it: { translation: it },
      pl: { translation: pl },
      de: { translation: de },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
