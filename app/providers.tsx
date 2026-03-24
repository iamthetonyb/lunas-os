"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ThemeProvider } from "next-themes";
import { ReactNode, useEffect, useState } from "react";
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n/client';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!convex) {
    // During static page generation (e.g. /_not-found) the env var is unavailable.
    // Return null to avoid rendering children that depend on Clerk/Convex providers.
    return null;
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
