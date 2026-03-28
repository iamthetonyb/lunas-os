'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export default function TermsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  return (
    <main className="min-h-screen bg-white dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      {/* Top-right controls */}
      {mounted && (
        <div className="fixed top-4 right-4 flex gap-2 z-10">
          <button
            onClick={toggleLang}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            {i18n.language === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            {resolvedTheme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-6 inline-block">&larr; {t('terms.backToLogin')}</Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('terms.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{t('terms.lastUpdated')}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s1Title')}</h2>
            <p>{t('terms.s1Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s2Title')}</h2>
            <p>{t('terms.s2Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s3Title')}</h2>
            <p>{t('terms.s3Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s4Title')}</h2>
            <p>{t('terms.s4Text')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('terms.s4List1')}</li>
              <li>{t('terms.s4List2')}</li>
              <li>{t('terms.s4List3')}</li>
              <li>{t('terms.s4List4')}</li>
              <li>{t('terms.s4List5')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s5Title')}</h2>
            <p>{t('terms.s5Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s6Title')}</h2>
            <p>{t('terms.s6Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s7Title')}</h2>
            <p>{t('terms.s7Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s8Title')}</h2>
            <p>{t('terms.s8Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s9Title')}</h2>
            <p>{t('terms.s9Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s10Title')}</h2>
            <p>{t('terms.s10Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s11Title')}</h2>
            <p>{t('terms.s11Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('terms.s12Title')}</h2>
            <p>{t('terms.s12Text')} <a href={`mailto:${t('terms.contactEmail')}`} className="text-blue-600 dark:text-blue-400 hover:underline">{t('terms.contactEmail')}</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-gray-500">
          <Link href="/privacy" className="text-blue-500 hover:underline">{t('terms.privacyLink')}</Link>
          <span className="mx-2">|</span>
          <Link href="/login" className="text-blue-500 hover:underline">{t('terms.backToLogin')}</Link>
        </div>
      </div>
    </main>
  );
}
