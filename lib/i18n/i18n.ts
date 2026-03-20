import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

// Server-side i18n — used by Server Components if needed.
// Uses the same file-based approach as client.ts.

if (!i18n.isInitialized) {
  i18n
    .use(
      resourcesToBackend(
        (language: string, namespace: string) =>
          import(`../../public/locales/${language}/${namespace}.json`)
      )
    )
    .use(initReactI18next)
    .init({
      fallbackLng: 'en',
      supportedLngs: ['en', 'es'],
      defaultNS: 'translation',
      ns: ['translation'],
      debug: false,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
}

export default i18n;
