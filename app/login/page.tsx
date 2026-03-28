'use client';

import { SignIn } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Hide Clerk dev mode banner globally */}
      <style>{`
        .cl-internal-b3fm6y,
        [data-testid="clerk-development-banner"],
        .cl-dev-mode-banner,
        div[style*="development"] {
          display: none !important;
        }
      `}</style>

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
          <p className="text-sm text-gray-500 dark:text-gray-400">Construction Cleanup Management</p>
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
              socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50 transition-colors',
              formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 transition-colors',
              footerActionLink: 'text-blue-600 hover:text-blue-700',
            },
          }}
        />

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          By signing in you agree to our{' '}
          <a href="/terms" className="text-blue-500 hover:text-blue-600 hover:underline">Terms &amp; Conditions</a>
          {' '}&amp;{' '}
          <a href="/privacy" className="text-blue-500 hover:text-blue-600 hover:underline">Privacy Policy</a>
        </p>
      </div>
    </main>
  );
}
