'use client';
import { ReactNode } from 'react';

function LoadingSkeleton({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="animate-pulse space-y-4 w-full max-w-md">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto" />
      </div>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        {message ?? 'Loading...'}
      </p>
    </div>
  );
}

function ErrorMessage({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-red-600 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-red-700 dark:text-red-400">
        {message ?? 'Something went wrong. Please try again.'}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {message ?? 'No data found.'}
      </p>
    </div>
  );
}

type QueryWrapperProps<T> = {
  data: T | undefined | null;
  children: (data: T) => ReactNode;
  loadingMessage?: string;
  errorMessage?: string;
  emptyMessage?: string;
};

export function QueryWrapper<T>({
  data,
  children,
  loadingMessage,
  errorMessage,
  emptyMessage,
}: QueryWrapperProps<T>) {
  if (data === undefined) return <LoadingSkeleton message={loadingMessage} />;
  if (data === null) return <ErrorMessage message={errorMessage} />;
  if (Array.isArray(data) && data.length === 0)
    return <EmptyState message={emptyMessage} />;
  return <>{children(data)}</>;
}

export { LoadingSkeleton, ErrorMessage, EmptyState };
