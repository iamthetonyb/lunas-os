'use client';

import { signIn } from 'next-auth/react';
import { FormEvent, useState } from 'react';

export default function SignInPage() {
  const [email, setEmail] = useState('admin@lunas.local');
  const [password, setPassword] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await signIn('credentials', {
      email,
      password,
      redirect: true,
      callbackUrl: '/dashboard',
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
      <input
        className="w-full border px-3 py-2 rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        type="email"
      />
      <input
        className="w-full border px-3 py-2 rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        type="password"
      />
      <button className="px-4 py-2 rounded bg-black text-white">Sign in</button>
    </form>
  );
}
