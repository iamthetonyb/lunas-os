import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

if (typeof window !== 'undefined') {
  i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: 'en',
      supportedLngs: ['en', 'en-US', 'es'],
      debug: true,
      interpolation: {
        escapeValue: false,
      },
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },
    });
} else {
  // Server-side initialization (no backend, prevents build hang)
  i18n
    .use(initReactI18next)
    .init({
      fallbackLng: 'en',
      supportedLngs: ['en', 'en-US', 'es'],
      debug: false,
      resources: {
        en: { translation: {} },
        'en-US': { translation: {} },
        es: { translation: {} },
      },
      interpolation: {
        escapeValue: false,
      },
    });
}

export default i18n;
