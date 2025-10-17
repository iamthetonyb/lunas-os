'use client';

import { usePathname } from 'next/navigation';
import { AppLayout } from './app-layout';

const publicPaths = ['/login', '/forgot-password'];

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = publicPaths.some(path => pathname?.startsWith(path));

  if (isPublicPage) {
    return <>{children}</>;
  }

  return <AppLayout>{children}</AppLayout>;
}
