import { ok } from '@/lib/api/http';
import { requireMembership } from '@/lib/auth/guards';

export const runtime = 'nodejs';

export const GET = async () => {
  try {
    const membership = await requireMembership();
    return ok({
      userId: membership.userId,
      orgId: membership.orgId,
      role: (membership as any).role,
    });
  } catch (err) {
    // Return null if not authenticated
    return ok(null);
  }
};
