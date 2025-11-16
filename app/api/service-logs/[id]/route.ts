import { and, eq } from 'drizzle-orm';
import { safe, ok, err } from '@/lib/api/http';
import { requireMembership } from '@/lib/auth/guards';
import { getDb } from '@/lib/db/get-db';
import { serviceLogs } from '@/db/schema';
import { serviceLogInputSchema } from '@/lib/validation/service-log';

const updateSchema = serviceLogInputSchema.partial();

export const runtime = 'nodejs';

export const GET = safe(async (_req, { params: paramsPromise }: { params: Promise<{ id: string }> }) => {
  const membership = await requireMembership();
  const db = await getDb();

  const params = await paramsPromise;
  const record = await db.query.serviceLogs.findFirst({
    where: and(eq(serviceLogs.id, params.id), eq(serviceLogs.orgId, membership.orgId)),
  });

  if (!record) {
    return err('Service log not found', 404);
  }

  return ok(record);
});

export const PUT = safe(async (req, { params: paramsPromise }: { params: Promise<{ id: string }> }) => {
  const membership = await requireMembership(['admin', 'backoffice', 'contractor']);
  const db = await getDb();

  const params = await paramsPromise;
  const existing = await db.query.serviceLogs.findFirst({
    where: and(eq(serviceLogs.id, params.id), eq(serviceLogs.orgId, membership.orgId)),
  });

  if (!existing) {
    return err('Service log not found', 404);
  }

  const raw = await req.json();
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Invalid payload', 400, parsed.error.flatten());
  }
  const payload = parsed.data;

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  const normalizeDate = (value: unknown) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') {
      return existing.date;
    }
    const nextDate =
      value instanceof Date ? value : new Date(typeof value === 'string' ? value : String(value));
    if (Number.isNaN(nextDate.getTime())) {
      return existing.date;
    }
    return nextDate.toISOString().split('T')[0];
  };

  const dateValue = normalizeDate(payload.date);
  if (dateValue) {
    updates.date = dateValue;
  }

  const assign = <K extends keyof typeof payload>(key: K) => {
    if (payload[key] !== undefined) {
      updates[key as string] = payload[key];
    }
  };

  assign('projectName');
  assign('builder');
  assign('community');
  assign('address');
  assign('lot');
  assign('unitLot');
  assign('serviceType');
  assign('category');
  assign('status');
  assign('timeIn');
  assign('timeOut');
  assign('hours');
  assign('team');
  assign('extras');
  assign('supervisor');
  assign('foreman');
  assign('crewLeader');
  assign('explainWork');
  assign('amount');
  assign('source');
  assign('photos');

  if (payload.date === null) {
    updates.date = existing.date;
  }

  const [updated] = await db
    .update(serviceLogs)
    .set(updates)
    .where(and(eq(serviceLogs.id, params.id), eq(serviceLogs.orgId, membership.orgId)))
    .returning();

  return ok(updated);
});

export const DELETE = safe(async (req, { params: paramsPromise }: { params: Promise<{ id: string }> }) => {
  const params = await paramsPromise;
  if (!params.id) {
    return err('Service log ID is required', 400);
  }
  const membership = await requireMembership(['admin', 'backoffice']);
  const db = await getDb();

  const existing = await db.query.serviceLogs.findFirst({
    where: and(eq(serviceLogs.id, params.id), eq(serviceLogs.orgId, membership.orgId)),
  });

  if (!existing) {
    return err('Service log not found', 404);
  }

  await db.delete(serviceLogs).where(eq(serviceLogs.id, params.id));

  return new Response(null, { status: 204 });
});
