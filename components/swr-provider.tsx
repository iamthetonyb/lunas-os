'use client';

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        shouldRetryOnError: false,
        dedupingInterval: 5000,
        errorRetryCount: 1,
        onError: (error, key) => {
          console.error(`SWR Error [${key}]:`, error);
          // Don't crash the app on fetch errors
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
