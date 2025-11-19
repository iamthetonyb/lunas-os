import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/lib/db/get-db';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

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
        if (!parsed.success) {
          console.log('[auth] Invalid credentials format');
          return null;
        }
        const { email, password } = parsed.data;

        // Check database users first
        try {
          const user = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.email, email),
          });

          if (!user) {
            console.log('[auth] User not found:', email);
            return null;
          }

          // Check dev credentials (fallback for admin access)
          if (
            devPassword &&
            devEmails.includes(email.toLowerCase()) &&
            password === devPassword
          ) {
            console.log('[auth] Valid dev credentials for:', email);
            return { 
              id: user.id, 
              email: user.email, 
              name: user.name || email.split('@')[0] 
            };
          }

          // Check hashed password
          if (!user.passwordHash) {
            console.log('[auth] User has no password hash:', email);
            return null;
          }

          const passwordValid = await bcrypt.compare(password, user.passwordHash);
          
          if (!passwordValid) {
            console.log('[auth] Invalid password for:', email);
            return null;
          }

          console.log('[auth] Valid credentials from DB for:', email);
          return { 
            id: user.id, 
            email: user.email, 
            name: user.name || email.split('@')[0] 
          };
        } catch (error) {
          console.error('[auth] Error checking credentials:', error);
          return null;
        }
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
      MicrosoftEntraID({
        clientId: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
        issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
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
      // Add role and orgId from org_members to the session
      async jwt({ token, user }) {
        if (user?.id) {
          // Load user from users table
          const dbUser = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.id, user.id),
          });
          if (dbUser) {
            token.userId = dbUser.id;
            token.userRole = dbUser.role;
            
            // Load org membership (role + orgId)
            const membership = await db.query.orgMembers.findFirst({
              where: (orgMembers, { eq }) => eq(orgMembers.userId, dbUser.id),
            });
            if (membership) {
              token.orgId = membership.orgId;
              token.orgRole = membership.role;
            }
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (token?.userId) {
          session.user.id = token.userId as string;
        }
        if (token?.userRole) {
          session.user.role = token.userRole as string;
        }
        if (token?.orgId) {
          session.user.orgId = token.orgId as string;
        }
        if (token?.orgRole) {
          session.user.orgRole = token.orgRole as string;
        }
        return session;
      },
    },
  };
});
