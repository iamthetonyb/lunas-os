'use client';

import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';

export function Header() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    router.replace(pathname);
  };

  return (
    <header className="bg-gray-800 p-4 text-white">
      <div className="container mx-auto flex justify-between">
        <h1 className="text-xl font-bold">LUNAS-OS</h1>
        <div>
          <button onClick={() => changeLanguage('en')} className="mr-2">EN</button>
          <button onClick={() => changeLanguage('es-MX')}>ES</button>
        </div>
      </div>
    </header>
  );
}
