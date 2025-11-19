import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/get-db';
import { serviceLogs } from '@/db/schema';
import { requireMembership } from '@/lib/auth/guards';
import { publishOrgEvent } from '@/lib/ably';
import { serviceLogInputSchema } from '@/lib/validation/service-log';
import { err, ok, safe } from '@/lib/api/http';

export const runtime = 'nodejs';

export const GET = safe(async (req) => {
  const membership = await requireMembership();
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q')?.trim();
  const dateFilter = searchParams.get('date')?.trim();

  const filters = [eq(serviceLogs.orgId, membership.orgId)];

  if (dateFilter) {
    filters.push(eq(serviceLogs.date, dateFilter));
  }

  if (search) {
    const pattern = `%${search}%`;
    const searchCondition = or(
      ilike(serviceLogs.projectName, pattern),
      ilike(serviceLogs.builder, pattern),
      ilike(serviceLogs.community, pattern),
      ilike(serviceLogs.address, pattern),
      ilike(serviceLogs.lot, pattern),
      ilike(serviceLogs.serviceType, pattern),
      ilike(serviceLogs.category, pattern),
      ilike(serviceLogs.explainWork, pattern)
    );
    if (searchCondition) {
      filters.push(searchCondition);
    }
  }

  const rows = await db
    .select()
    .from(serviceLogs)
    .where(and(...filters))
    .orderBy(desc(serviceLogs.date), desc(serviceLogs.createdAt))
    .limit(200);

  return ok(rows);
});

export const POST = safe(async (req) => {
  const membership = await requireMembership(['admin', 'backoffice', 'contractor']);
  const db = await getDb();
  const raw = await req.json();
  const parsed = serviceLogInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Invalid payload', 400, parsed.error.flatten());
  }
  const payload = parsed.data;
  const normalizedDate =
    payload.date instanceof Date
      ? payload.date.toISOString().split('T')[0]
      : new Date(payload.date).toISOString().split('T')[0];

  const [inserted] = await db
    .insert(serviceLogs)
    .values({
      orgId: membership.orgId,
      date: normalizedDate,
      projectName: payload.projectName ?? null,
      builder: payload.builder ?? null,
      community: payload.community ?? null,
      address: payload.address ?? null,
      lot: payload.lot ?? null,
      unitLot: payload.unitLot ?? null,
      serviceType: payload.serviceType ?? null,
      category: payload.category ?? null,
      status: payload.status ?? null,
      timeIn: payload.timeIn ?? null,
      timeOut: payload.timeOut ?? null,
      hours: payload.hours != null ? String(payload.hours) : null,
      team: payload.team?.length ? payload.team : null,
      extras: payload.extras ?? null,
      supervisor: payload.supervisor ?? null,
      foreman: payload.foreman ?? null,
      crewLeader: payload.crewLeader ?? null,
      explainWork: payload.explainWork ?? null,
      amount: payload.amount != null ? String(payload.amount) : null,
      source: payload.source ?? 'manual',
      photos: payload.photos?.length ? payload.photos : null,
      createdBy: membership.userId,
    })
    .returning();

  await publishOrgEvent(membership.orgId, 'serviceLogs.updated', { id: inserted.id });

  return ok(inserted, { status: 201 });
});
