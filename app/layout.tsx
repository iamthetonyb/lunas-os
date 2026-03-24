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

// All pages require authentication (Clerk + Convex) — skip static generation
// at build time so env vars like NEXT_PUBLIC_CONVEX_URL don't need to exist
// during the build step.
export const dynamic = 'force-dynamic';

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
