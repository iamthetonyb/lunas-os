'use client';

import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-blue-50">
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
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Lunas OS</h1>
          <p className="mt-1 text-sm text-gray-500">Construction Cleanup Management</p>
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
              footerAction: 'hidden',
            },
          }}
        />

        <p className="text-center text-xs text-gray-400">
          Powered by Lunas OS v2
        </p>
      </div>
    </main>
  );
}
