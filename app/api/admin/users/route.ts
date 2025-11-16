import { getDb } from '@/lib/db/get-db';
import { orgMembers, orgs, users } from '@/db/schema';
import { requireMembership } from '@/lib/auth/guards';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { safe, ok } from '@/lib/api/http';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

const membershipSchema = z.object({
  userId: z.string().uuid(),
  orgId: z.string().uuid(),
  role: z.enum(['admin', 'backoffice', 'contractor']),
});

export const GET = safe(async () => {
  await requireMembership(['admin']);
  const db = await getDb();

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      systemRole: users.role,
      orgMemberId: orgMembers.id,
      memberRole: orgMembers.role,
      orgId: orgMembers.orgId,
      orgName: orgs.name,
    })
    .from(users)
    .leftJoin(orgMembers, eq(users.id, orgMembers.userId))
    .leftJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .orderBy(users.name);

  const userMap = new Map<
    string,
    {
      id: string;
      name: string | null;
      email: string;
      systemRole: string | null;
      memberships: { orgId: string; orgName: string; role: string }[];
    }
  >();

  rows.forEach((row) => {
    if (!userMap.has(row.userId)) {
      userMap.set(row.userId, {
        id: row.userId,
        name: row.name,
        email: row.email,
        systemRole: row.systemRole,
        memberships: [],
      });
    }
    const target = userMap.get(row.userId)!;
    if (row.orgId && row.orgName && row.memberRole) {
      target.memberships.push({
        orgId: row.orgId,
        orgName: row.orgName,
        role: row.memberRole,
      });
    }
  });

  const orgList = await db.query.orgs.findMany({
    orderBy: (orgs, { asc }) => asc(orgs.name),
  });

  return ok({
    users: Array.from(userMap.values()),
    orgs: orgList,
  });
});

export const POST = safe(async (req: Request) => {
  await requireMembership(['admin']);
  const db = await getDb();
  const payload = membershipSchema.parse(await req.json());

  const [membership] = await db
    .insert(orgMembers)
    .values({
      orgId: payload.orgId,
      userId: payload.userId,
      role: payload.role,
    })
    .onConflictDoUpdate({
      target: orgMembers.orgMemberUnique,
      set: { role: payload.role },
    })
    .returning();

  return ok(membership, { status: 201 });
});
