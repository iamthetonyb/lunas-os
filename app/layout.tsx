import type { Metadata } from 'next';
import './globals.css';
import { SWRProvider } from '@/components/swr-provider';

export const metadata: Metadata = { title: 'Lunas OS', description: 'Construction Cleanup Management' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  );
}