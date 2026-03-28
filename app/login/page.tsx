'use client';

import { SignIn } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Hide Clerk "Don't have an account", "Secured by Clerk", and dev mode banner */}
      <style>{`
        .cl-footerAction,
        .cl-footer,
        .cl-internal-b3fm6y,
        [data-testid="clerk-development-banner"],
        .cl-dev-mode-banner {
          display: none !important;
          height: 0 !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>

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
            {resolvedTheme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
          </button>
        </div>
      )}

      <div className="w-full max-w-md space-y-6">
        <div className="text-center flex flex-col items-center">
          {mounted && (
            <Image
              src={resolvedTheme === 'dark' ? '/lunas-light-logo.png' : '/lunas-dark-logo.png'}
              alt="Lunas Construction Cleanup"
              width={180}
              height={60}
              priority
              className="mb-3"
            />
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('navigation.constructionCleanup')}</p>
        </div>

        <SignIn
          routing="hash"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorPrimary: '#2563eb',
              borderRadius: '0.75rem',
            },
            elements: {
              rootBox: 'mx-auto w-full',
              card: 'shadow-lg border border-gray-200 rounded-xl',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              footer: '!hidden',
              footerAction: '!hidden',
              socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50 transition-colors',
              formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 transition-colors',
            },
          }}
        />

        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          {t('login.needAccount')}{' '}
          <a href="mailto:dispatch@lunasinc.com" className="text-blue-500 hover:text-blue-600 hover:underline">{t('login.contactAdmin')}</a>
        </p>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          {t('login.agreePrefix')}{' '}
          <a href="/terms" className="text-blue-500 hover:text-blue-600 hover:underline">{t('login.termsLink')}</a>
          {' '}&amp;{' '}
          <a href="/privacy" className="text-blue-500 hover:text-blue-600 hover:underline">{t('login.privacyLink')}</a>
        </p>
      </div>
    </main>
  );
}
