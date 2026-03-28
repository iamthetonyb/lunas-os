'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export default function PrivacyPage() {
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
        <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-6 inline-block">&larr; {t('privacy.backToLogin')}</Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('privacy.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{t('privacy.lastUpdated')}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s1Title')}</h2>
            <p>{t('privacy.s1Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s2Title')}</h2>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3">{t('privacy.s2PersonalTitle')}</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('privacy.s2PersonalList1')}</li>
              <li>{t('privacy.s2PersonalList2')}</li>
              <li>{t('privacy.s2PersonalList3')}</li>
              <li>{t('privacy.s2PersonalList4')}</li>
            </ul>

            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3">{t('privacy.s2AutoTitle')}</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('privacy.s2AutoList1')}</li>
              <li>{t('privacy.s2AutoList2')}</li>
              <li>{t('privacy.s2AutoList3')}</li>
              <li>{t('privacy.s2AutoList4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s3Title')}</h2>
            <p>{t('privacy.s3Text')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('privacy.s3List1')}</li>
              <li>{t('privacy.s3List2')}</li>
              <li>{t('privacy.s3List3')}</li>
              <li>{t('privacy.s3List4')}</li>
              <li>{t('privacy.s3List5')}</li>
              <li>{t('privacy.s3List6')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s4Title')}</h2>
            <p>{t('privacy.s4Text')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>{t('privacy.s4Label1')}</strong> — {t('privacy.s4Desc1')}</li>
              <li><strong>{t('privacy.s4Label2')}</strong> — {t('privacy.s4Desc2')}</li>
              <li><strong>{t('privacy.s4Label3')}</strong> — {t('privacy.s4Desc3')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s5Title')}</h2>
            <p>{t('privacy.s5Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s6Title')}</h2>
            <p>{t('privacy.s6Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s7Title')}</h2>
            <p>{t('privacy.s7Text')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('privacy.s7List1')}</li>
              <li>{t('privacy.s7List2')}</li>
              <li>{t('privacy.s7List3')}</li>
              <li>{t('privacy.s7List4')}</li>
              <li>{t('privacy.s7List5')}</li>
            </ul>
            <p className="mt-2">{t('privacy.s7Outro')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s8Title')}</h2>
            <p>{t('privacy.s8Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s9Title')}</h2>
            <p>{t('privacy.s9Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s10Title')}</h2>
            <p>{t('privacy.s10Text')}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.s11Title')}</h2>
            <p>{t('privacy.s11Text')} <a href={`mailto:${t('privacy.contactEmail')}`} className="text-blue-600 dark:text-blue-400 hover:underline">{t('privacy.contactEmail')}</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-gray-500">
          <Link href="/terms" className="text-blue-500 hover:underline">{t('privacy.termsLink')}</Link>
          <span className="mx-2">|</span>
          <Link href="/login" className="text-blue-500 hover:underline">{t('privacy.backToLogin')}</Link>
        </div>
      </div>
    </main>
  );
}
