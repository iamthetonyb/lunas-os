"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ThemeProvider } from "next-themes";
import { ReactNode, useEffect, useState } from "react";
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n/client';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!convex) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', color: '#b91c1c' }}>
        <h1>Configuration Error</h1>
        <p>Missing required environment variables. Check Vercel settings:</p>
        <ul>
          <li>NEXT_PUBLIC_CONVEX_URL {convexUrl ? '✓' : '✗ missing'}</li>
        </ul>
        <p>Ensure these are enabled for <strong>Preview</strong> environments, not just Production.</p>
      </div>
    );
  }

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <I18nextProvider i18n={i18n}>
            {mounted ? children : null}
          </I18nextProvider>
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
