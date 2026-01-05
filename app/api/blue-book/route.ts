import { getDb } from '@/lib/db/get-db';
import { blueBookEntries, builders, communities, assignments, crews, dispatchBatches } from '@/db/schema';
import { and, eq, isNull, count, like, or, asc, ilike, inArray } from 'drizzle-orm';
import { safe, ok } from '@/lib/api/http';
import { requireMembership } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export const GET = safe(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const builderId = searchParams.get('builderId');
  const status = searchParams.get('status');
  const invoiced = searchParams.get('invoiced');
  const searchTerm = searchParams.get('search')?.trim();
  const sortParam = (searchParams.get('sort') || 'checkDate').toLowerCase();

  const db = await getDb();
  const pageParam = searchParams.get('page');
  const pageSizeParam = searchParams.get('pageSize');

  const isPaginated = Boolean(pageParam || pageSizeParam);
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const pageSize = Math.max(1, Math.min(parseInt(pageSizeParam || '25', 10) || 25, 100));
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (builderId) {
    conditions.push(eq(blueBookEntries.builderId, builderId));
  }
  if (status === 'PENDING' || status === 'COMPLETE') {
    conditions.push(eq(blueBookEntries.status, status));
  }
  if (invoiced === 'false') {
    conditions.push(isNull(blueBookEntries.invoiceLineId));
  }
  if (searchTerm) {
    const pattern = `%${searchTerm}%`;

    // Find matching builders and communities first
    // This allows us to "search" them without complex joins in the findMany where clause
    const matchedBuilders = await db.select({ id: builders.id }).from(builders).where(ilike(builders.name, pattern));
    const matchedCommunities = await db.select({ id: communities.id }).from(communities).where(ilike(communities.name, pattern));

    const builderIds = matchedBuilders.map(b => b.id);
    const communityIds = matchedCommunities.map(c => c.id);

    conditions.push(
      or(
        like(blueBookEntries.lot, pattern),
        like(blueBookEntries.poNumber, pattern),
        like(blueBookEntries.accountCategoryName, pattern),
        like(blueBookEntries.accountCategoryCode, pattern),
        like(blueBookEntries.checkNumber, pattern),
        // Add new name-based searches
        builderIds.length > 0 ? inArray(blueBookEntries.builderId, builderIds) : undefined,
        communityIds.length > 0 ? inArray(blueBookEntries.communityId, communityIds) : undefined
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Default sort: community name, then start date, then check date
  const orderByClauses =
    sortParam === 'checkdate'
      ? [
        asc(blueBookEntries.checkDate),
        asc(blueBookEntries.startDate),
        asc(blueBookEntries.createdAt),
      ]
      : [
        // Default to startDate sorting with community grouping
        asc(blueBookEntries.communityId),
        asc(blueBookEntries.startDate),
        asc(blueBookEntries.checkDate),
        asc(blueBookEntries.createdAt),
      ];

  await requireMembership(['admin', 'backoffice']);
  // db initialized at top
  const entries = await db.query.blueBookEntries.findMany({
    where,
    with: {
      builder: true,
      community: true,
      modelPlan: true,
      service: true,
    },
    orderBy: orderByClauses,
    ...(isPaginated ? { limit: pageSize, offset } : {}),
  });

  // Fetch assignment details (Crew & Foreman)
  const assignmentIds = entries
    .map(e => e.assignmentId)
    .filter((id): id is string => Boolean(id));

  const assignmentMap = new Map<string, { crewName: string | null; foremanName: string | null }>();

  if (assignmentIds.length > 0) {
    const assignmentDetails = await db
      .select({
        id: assignments.id,
        crewName: crews.name,
        foremanName: dispatchBatches.foremanName,
      })
      .from(assignments)
      .leftJoin(crews, eq(assignments.crewId, crews.id))
      .leftJoin(dispatchBatches, eq(assignments.dispatchBatchId, dispatchBatches.id))
      .where(inArray(assignments.id, assignmentIds));

    assignmentDetails.forEach(d => {
      assignmentMap.set(d.id, {
        crewName: d.crewName,
        foremanName: d.foremanName,
      });
    });
  }

  const formatted = (entries || []).map((entry) => ({
    id: entry.id,
    builderId: entry.builderId,
    builderName: entry.builder?.name ?? null,
    communityId: entry.communityId,
    communityName: entry.community?.name ?? null,
    lot: entry.lot,
    serviceId: entry.serviceId,
    serviceName: entry.service?.name ?? entry.accountCategoryName ?? null,
    status: entry.status,
    amount: entry.amount,
    invoiceNumber: entry.poNumber,
    checkNumber: entry.checkNumber,
    checkDate: entry.checkDate,
    checkTotal: entry.checkTotal,
    isAch: entry.isAch,
    accountCategoryCode: entry.accountCategoryCode,
    accountCategoryName: entry.accountCategoryName,
    startDate: entry.startDate,
    modelPlanId: entry.modelPlanId,
    modelPlanCode: entry.modelPlan?.code ?? null,
    modelPlanName: entry.modelPlan?.name ?? null,
    modelPlanSqft: entry.modelPlan?.sqft ?? null,
    source: entry.source ?? 'scraped',
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    assignedForemanName: entry.assignmentId && assignmentMap.has(entry.assignmentId)
      ? assignmentMap.get(entry.assignmentId)?.foremanName ?? entry.assignedForemanName
      : entry.assignedForemanName,
    crewName: entry.assignmentId ? assignmentMap.get(entry.assignmentId)?.crewName ?? null : null,
  }));

  if (isPaginated) {
    const totalQuery = db.select({ value: count() }).from(blueBookEntries);
    const totalResult = where ? await totalQuery.where(where) : await totalQuery;
    const total = Number(totalResult?.[0]?.value ?? 0);

    return ok({
      page,
      pageSize,
      total,
      entries: formatted,
    });
  }

  return ok(formatted);
});

export const POST = safe(async (req: Request) => {
  await requireMembership(['admin', 'backoffice']);
  const db = await getDb();

  const body = await req.json();
  const {
    builderId,
    communityId,
    serviceId,
    lot,
    startDate,
    status = 'PENDING',
    amount,
    invoiceNumber,
    checkNumber,
    checkDate,
    accountCategoryName,
    accountCategoryCode,
  } = body;

  if (!builderId || !communityId) {
    return ok({ error: 'Builder and Community are required' }, { status: 400 });
  }

  const [newEntry] = await db
    .insert(blueBookEntries)
    .values({
      builderId,
      communityId,
      serviceId: serviceId || null,
      lot: lot || null,
      startDate: startDate || null,
      status,
      amount: amount ? String(amount) : null,
      poNumber: invoiceNumber || null,
      checkNumber: checkNumber || null,
      checkDate: checkDate || null,
      accountCategoryName: accountCategoryName || null,
      accountCategoryCode: accountCategoryCode || null,
      source: 'manual',
    })
    .returning();

  return ok(newEntry, { status: 201 });
});
