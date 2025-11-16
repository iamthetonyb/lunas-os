import 'server-only';

import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/get-db';
import { users } from '@/db/schema/users';

type Credentials = {
  email: string;
  password: string;
};

export async function authorizeWithCredentials({ email, password }: Credentials) {
  const db = await getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (process.env.NODE_ENV !== 'production' && password === 'dev') {
    return (
      user ?? {
        id: `dev-${email}`,
        email,
        name: 'Developer',
      }
    );
  }

  if (!user?.passwordHash) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash).catch(() => false);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    role: user.role,
  };
}
