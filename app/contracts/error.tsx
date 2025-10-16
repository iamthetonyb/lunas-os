'use client';

import { useEffect } from 'react';
import { AppLayout } from '@/components/app-layout';

export default function ContractsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Contracts page error:', error);
  }, [error]);

  return (
    <AppLayout>
      <div className="px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Contracts Page Error
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                There was a problem loading the contracts configuration.
              </p>
            </div>

            {error.message && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm font-mono text-red-800 dark:text-red-300 break-words">
                  {error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
