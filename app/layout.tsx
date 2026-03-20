import type { Metadata } from 'next';
import './globals.css';
import { ConditionalLayout } from '@/components/conditional-layout';
import Providers from './providers';
import { Toaster } from 'sonner';
import { AIChatWidget } from '@/components/ai-chat-widget';

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
          <AIChatWidget />
        </Providers>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
