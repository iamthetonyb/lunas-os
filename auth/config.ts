import type { NextAuthConfig } from 'next-auth';

export const baseAuthConfig: Partial<NextAuthConfig> = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
};

export type { NextAuthConfig };
