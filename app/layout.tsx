import type { Metadata } from 'next';
import './globals.css';
import { SWRProvider } from '@/components/swr-provider';
import { AppLayout } from '@/components/app-layout';

export const metadata: Metadata = { 
  title: 'Lunas OS', 
  description: 'Construction Cleanup Management' 
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SWRProvider>
          <AppLayout>{children}</AppLayout>
        </SWRProvider>
      </body>
    </html>
  );
}