import { getDb } from '@/lib/db/get-db';
import { orgMembers, orgs, users } from '@/db/schema';
import { requireMembership } from '@/lib/auth/guards';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { safe, ok } from '@/lib/api/http';
import { NextResponse } from 'next/server';

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
      phone: users.phone,
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
      phone: string | null;
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
        phone: row.phone,
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
  
  const body = await req.json();
  console.log('Incoming membership update body:', body); // Log to server terminal
  console.log('Body type:', typeof body, 'Keys:', Object.keys(body || {}));
  
  const parsed = membershipSchema.safeParse(body);
  if (!parsed.success) {
    console.error('Membership validation failed:', parsed.error.flatten());
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  console.log('Parsed payload:', payload);

  try {
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
    
    console.log('Membership saved successfully:', membership);
    return ok(membership, { status: 201 });
  } catch (dbErr: any) {
    // Wrap DB operation in try/catch - Let 'safe' catch it
    console.error('DB error during membership update:', dbErr);
    console.error('DB error stack:', dbErr.stack);
    throw dbErr;
  }
});
