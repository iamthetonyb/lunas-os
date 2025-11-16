import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/lib/db/get-db';
import { z } from 'zod';

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const db = await getDb();
  const devEmails =
    (process.env.DEV_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  const devPassword = process.env.DEV_PASSWORD ?? '';

  return {
    trustHost: true,
    session: { strategy: 'jwt' },
    secret: process.env.AUTH_SECRET,
    pages: { signIn: '/signin' },
    adapter: DrizzleAdapter(db) as any,
    providers: [
      Credentials({
        id: 'credentials',
        name: 'Credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(raw) {
          const parsed = z
            .object({
              email: z.string().email(),
              password: z.string().min(1),
            })
            .safeParse(raw);
          if (!parsed.success) return null;
          const { email, password } = parsed.data;

          if (
            devPassword &&
            devEmails.includes(email.toLowerCase()) &&
            password === devPassword
          ) {
            return { id: email, email, name: email.split('@')[0] };
          }

          return null;
        },
      }),
    ],
  };
});
