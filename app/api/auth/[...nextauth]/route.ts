import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { db } from '../../../../db';
import { users } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import type { NextAuthOptions } from 'next-auth';

const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: { email: { label: 'Email', type: 'text' }, password: { label: 'Password', type: 'password' } },
      authorize: async (creds) => {
        if (!creds?.email || !creds?.password) return null;
        const [u] = await db.select().from(users).where(eq(users.email, creds.email.toLowerCase()));
        if (!u || !u.passwordHash) return null;
        const ok = await bcrypt.compare(creds.password, u.passwordHash);
        if (!ok) return null;
        return { id: u.id, name: u.name, email: u.email, role: u.role };
      },
    }),
  ],
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) { if (user) (token as any).role = (user as any).role; return token; },
    async session({ session, token }) { (session as any).role = (token as any).role; return session; },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
