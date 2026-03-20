import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from './convex/_generated/api';
import { Id } from './convex/_generated/dataModel';

const getConvex = (() => {
  let client: ConvexHttpClient | null = null;
  return () => {
    if (client) return client;
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
    client = new ConvexHttpClient(url);
    return client;
  };
})();

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
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
        console.log('[auth] Authorizing...');
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
        console.log('[auth] Checking user:', email);

        // Dev credentials fallback (works even if Convex is down)
        if (
          devPassword &&
          devEmails.includes(email.toLowerCase()) &&
          password === devPassword
        ) {
          console.log('[auth] Valid dev credentials for:', email);
          try {
            const convex = getConvex();
            const user = await convex.query(api.queries.getUserByEmail, { email });
            if (user) {
              return { id: user._id, email: user.email, name: user.name || email.split('@')[0] };
            }
          } catch (e) {
            console.warn('[auth] Convex lookup failed for dev user, using synthetic ID');
          }
          return { id: `dev-${email}`, email, name: email.split('@')[0] };
        }

        // Regular Convex-based auth
        try {
          const convex = getConvex();
          const user = await convex.query(api.queries.getUserByEmail, { email });

          if (!user) {
            console.log('[auth] User not found:', email);
            return null;
          }

          console.log('[auth] User found:', user._id, user.role);

          if (!user.passwordHash) {
            console.log('[auth] User has no password hash:', email);
            return null;
          }

          const passwordValid = await bcrypt.compare(password, user.passwordHash);
          if (!passwordValid) {
            console.log('[auth] Invalid password for:', email);
            return null;
          }

          console.log('[auth] Valid credentials from Convex for:', email);
          return {
            id: user._id,
            email: user.email,
            name: user.name || email.split('@')[0],
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
    session: { strategy: 'jwt' as const },
    secret: process.env.AUTH_SECRET,
    pages: { signIn: '/login' },
    providers,
    callbacks: {
      async jwt({ token, user }: any) {
        if (user?.id) {
          token.userId = user.id;
          try {
            // Skip Convex lookup for synthetic dev IDs
            if (typeof user.id === 'string' && user.id.startsWith('dev-')) {
              token.userRole = 'ADMIN';
              return token;
            }
            const convex = getConvex();
            const dbUser = await convex.query(api.queries.getUserById, {
              userId: user.id as Id<"users">,
            });
            if (dbUser) {
              token.userId = dbUser._id;
              token.userRole = dbUser.role;
              token.orgId = dbUser.orgId;
              token.orgRole = dbUser.orgRole;
            }
          } catch (e) {
            console.warn('[auth] JWT callback: Convex lookup failed, using basic user info');
          }
        }
        return token;
      },
      async session({ session, token }: any) {
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
