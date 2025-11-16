import type { Metadata } from 'next';
import './globals.css';
import { SWRProvider } from '@/components/swr-provider';
import { ConditionalLayout } from '@/components/conditional-layout';
import Providers from './providers';

export const metadata: Metadata = { 
  title: 'Lunas OS', 
  description: 'Construction Cleanup Management' 
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <SWRProvider>
            <ConditionalLayout>{children}</ConditionalLayout>
          </SWRProvider>
        </Providers>
      </body>
    </html>
  );
}
