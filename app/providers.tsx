"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n/client';

// Only create Convex client if URL is configured
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function Providers({ children }: { children: ReactNode }) {
  const content = (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <I18nextProvider i18n={i18n}>
          {children}
        </I18nextProvider>
      </ThemeProvider>
    </SessionProvider>
  );

  // Wrap with Convex only if configured
  if (convex) {
    return (
      <ConvexProvider client={convex}>
        {content}
      </ConvexProvider>
    );
  }

  return content;
}
