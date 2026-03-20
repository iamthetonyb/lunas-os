'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

/**
 * Compact language toggle — designed to sit inside the navigation sidebar.
 * Shows current language as a pill selector: EN | ES
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isEn = i18n.language?.startsWith('en');

  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-lg">
      <button
        onClick={() => i18n.changeLanguage('en')}
        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${
          isEn
            ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        }`}
        aria-label="Switch to English"
      >
        EN
      </button>
      <button
        onClick={() => i18n.changeLanguage('es')}
        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${
          !isEn
            ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        }`}
        aria-label="Cambiar a Español"
      >
        ES
      </button>
    </div>
  );
}
