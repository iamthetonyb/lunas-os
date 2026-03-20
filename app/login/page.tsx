'use client';

import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <SignIn
        routing="hash"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-md',
          },
        }}
      />
    </main>
  );
}
