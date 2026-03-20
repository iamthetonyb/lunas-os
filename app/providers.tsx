"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ReactNode, useEffect, useState } from "react";
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n/client';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required. Set it in .env.local");
}
const convex = new ConvexReactClient(convexUrl);

export default function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ConvexProvider client={convex}>
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <I18nextProvider i18n={i18n}>
            {mounted ? children : null}
          </I18nextProvider>
        </ThemeProvider>
      </SessionProvider>
    </ConvexProvider>
  );
}
