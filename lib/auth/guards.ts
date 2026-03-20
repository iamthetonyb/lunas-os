import 'server-only';

import { auth } from '@/auth';
import { getConvexClient } from '@/lib/convex/http-client';
import { api } from '@/convex/_generated/api';

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
  const convex = getConvexClient();
  const user = await convex.query(api.queries.getUserByEmail, { email: userEmail });
  if (!user) return null;
  return {
    userId: user._id,
    email: userEmail,
    orgId: user.orgId,
    role: user.orgRole,
  };
}

export async function requireMembership(allowed: string[] = []) {
  const { user } = await requireSession();
  const membership = await getMembership(user!.email!);
  if (!membership) {
    throw new ForbiddenError('Not a member of any org');
  }
  if (allowed.length) {
    const role = String(membership.role ?? '').toLowerCase();
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
    role: membership.role,
  };
}

export async function requireRole(role: string | string[]) {
  const membership = await requireMembership(Array.isArray(role) ? role : [role]);
  return {
    id: membership.userId,
    orgId: membership.orgId,
    role: membership.role,
  };
}
