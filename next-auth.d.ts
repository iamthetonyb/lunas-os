import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role?: string | null;
      orgId?: string | null;
      orgRole?: string | null;
    };
  }

  interface User {
    id: string;
    role?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string | null;
    orgId?: string | null;
    orgRole?: string | null;
  }
}
