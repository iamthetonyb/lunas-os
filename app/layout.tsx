import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Lunas OS', description: 'Construction Cleanup Management' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}