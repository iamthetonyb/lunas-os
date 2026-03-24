"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ThemeProvider } from "next-themes";
import { ReactNode, useEffect, useState } from "react";
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n/client';

// During static generation (e.g. /_not-found) NEXT_PUBLIC_CONVEX_URL may be
// absent. Use a placeholder so the provider tree still renders without crashing
// child components that depend on Clerk/Convex hooks. The placeholder client is
// never used at runtime since the real env var is always set.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

export default function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
