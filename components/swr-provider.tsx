'use client';

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

// Global fetcher with robust error handling
const globalFetcher = async (url: string) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Global fetcher: API request failed: ${url} - Status: ${res.status}`);
      // Return empty array for common failures
      if (res.status === 404 || res.status >= 500) {
        return [];
      }
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Global fetcher error for', url, error);
    return [];
  }
};

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: globalFetcher,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        shouldRetryOnError: false,
        dedupingInterval: 5000,
        errorRetryCount: 0,
        errorRetryInterval: 5000,
        keepPreviousData: true,
        onError: (error, key) => {
          // Silently handle errors to prevent crashes - just log them
          if (error && error.message !== 'AbortError') {
            console.error(`SWR Error [${key}]:`, error);
          }
        },
        onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
          // Never retry on 404
          if (error.status === 404) return;
          // Never retry more than once
          if (retryCount >= 1) return;
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
