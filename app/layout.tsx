import type { Metadata } from 'next';
import './globals.css';
import { ConditionalLayout } from '@/components/conditional-layout';
import Providers from './providers';
import { Toaster } from 'sonner';
import { LanguageToggle } from '@/components/language-toggle';

export const metadata: Metadata = {
  title: 'Lunas OS',
  description: 'Construction Cleanup Management'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground relative">
        <Providers>
          <ConditionalLayout>{children}</ConditionalLayout>
          <LanguageToggle />
        </Providers>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
