import 'server-only';

import { auth } from '@/auth';
import { getDb } from '@/lib/db/get-db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

export class UnauthorizedError extends Error {
  status: number;
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = 401;
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends Error {
  status: number;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new UnauthorizedError();
  }
  return session;
}

export async function getMembership(userEmail: string) {
  const db = await getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, userEmail),
  });
  if (!user) return null;
  const membership = await db.query.orgMembers.findFirst({
    where: eq(schema.orgMembers.userId, user.id),
  });
  return membership ? { ...membership, userId: user.id, email: userEmail } : null;
}

export async function requireMembership(allowed: string[] = []) {
  const { user } = await requireSession();
  const membership = await getMembership(user!.email!);
  if (!membership) {
    throw new ForbiddenError('Not a member of any org');
  }
  if (allowed.length) {
    const role = String((membership as any).role ?? '').toLowerCase();
    const ok = allowed.map((item) => item.toLowerCase()).includes(role);
    if (!ok) {
      console.error('[guards] Role check failed:', {
        userRole: role,
        requiredRoles: allowed,
        userEmail: user!.email,
      });
      throw new ForbiddenError(`Insufficient role. Required: ${allowed.join('|')}, Current: ${role}`);
    }
  }
  return membership;
}

export async function requireUser() {
  const session = await requireSession();
  const membership = await getMembership(session.user!.email!);
  if (!membership) {
    throw new UnauthorizedError();
  }
  return {
    id: membership.userId,
    email: session.user!.email!,
    orgId: membership.orgId,
    role: (membership as any).role,
  };
}

export async function requireRole(role: string | string[]) {
  const membership = await requireMembership(Array.isArray(role) ? role : [role]);
  return {
    id: membership.userId,
    orgId: membership.orgId,
    role: (membership as any).role,
  };
}
