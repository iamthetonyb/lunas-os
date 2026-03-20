'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="fixed bottom-4 right-4 z-50 p-3 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
      aria-label="Toggle Language"
    >
      <span className="text-xl group-hover:scale-110 transition-transform duration-200">
        {i18n.language === 'en' ? '🇺🇸' : '🇲🇽'}
      </span>
      <span className="sr-only">
        {i18n.language === 'en' ? 'Switch to Spanish' : 'Switch to English'}
      </span>
    </button>
  );
}
