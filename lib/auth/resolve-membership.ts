import 'server-only';

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/get-db';
import { orgMembers } from '@/db/schema/org_members';

export async function resolveOrgMembership(userId: string) {
  const db = await getDb();
  return db.query.orgMembers.findFirst({
    where: eq(orgMembers.userId, userId),
  });
}
