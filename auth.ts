import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import AzureAD from 'next-auth/providers/azure-ad';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/lib/db/get-db';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const db = await getDb();
  const devEmails =
    (process.env.DEV_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  const devPassword = process.env.DEV_PASSWORD ?? '';

  const providers: any[] = [
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
  ];

  // Add Google OAuth if configured
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }

  // Add Microsoft/Azure AD OAuth if configured
  if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
    providers.push(
      AzureAD({
        clientId: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
        tenantId: process.env.AZURE_AD_TENANT_ID,
      })
    );
  }

  return {
    trustHost: true,
    session: { strategy: 'jwt' },
    secret: process.env.AUTH_SECRET,
    pages: { signIn: '/login' },
    adapter: DrizzleAdapter(db) as any,
    providers,
    callbacks: {
      // Add role from org_members to the session
      async jwt({ token, user }) {
        if (user?.id) {
          // Load membership role from org_members table
          const membership = await db.query.orgMembers.findFirst({
            where: (orgMembers, { eq }) => eq(orgMembers.userId, user.id),
          });
          if (membership) {
            token.role = membership.role;
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (token?.role) {
          session.user.role = token.role as string;
        }
        return session;
      },
    },
  };
});
