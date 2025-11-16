import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/get-db';
import { blueBookEntries, builders, communities, modelPlans, services } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { withErrorHandling } from '@/lib/api-handler';

export const runtime = 'nodejs';

const db = await getDb();

type HarvesterItem = {
  checkDate: string;
  checkNumber: string;
  isACH: boolean;
  checkTotal: number;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  jobNumber: string;
  jobAddress: string;
  accountCategory: string;
  planNumber: string;
  optionNumber: string;
  startDate: string | null;
  completedDate: string | null;
  lineAmount: number;
};

type HarvesterPayload = {
  start: string;
  end: string;
  items: HarvesterItem[];
  jobs?: Array<{
    communityCode: string | null;
    communityName: string | null;
    scarStartDate: string | null;
  }>;
};

function splitJobNumber(jobNumber: string | null | undefined) {
  if (!jobNumber) return { communityCode: null, lot: null };
  const segments = jobNumber.split('-').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return { communityCode: null, lot: null };
  const [communityCode, lot] = segments;
  return {
    communityCode: communityCode || null,
    lot: lot || null,
  };
}

function parseAccountCategory(raw: string | null | undefined) {
  if (!raw) return { code: null, name: null };
  const match = raw.match(/^(\d+)\s*-\s*(.*?)(?:\s*-\s*\d+)?$/);
  if (match) {
    return {
      code: match[1]?.trim() || null,
      name: match[2]?.trim() || null,
    };
  }
  return {
    code: null,
    name: raw.trim() || null,
  };
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.trim().split(' ')[0];
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  const month = Number(mm);
  const day = Number(dd);
  const year = Number(yyyy);
  if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function handler(req: Request) {
  if (process.env.INGEST_TOKEN) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const body = (await req.json()) as HarvesterPayload;
  const { start, end, items } = body;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'Invalid payload: items must be an array' }, { status: 400 });
  }

  const builder = await db.query.builders.findFirst({
    where: eq(builders.name, 'Pulte'),
  });
  const builderId = builder?.id ?? null;
  const communityCache = new Map<string, string>();
  const serviceCache = new Map<string, string>();
  const modelPlanCache = new Map<string, string | null>();
  const jobMap = new Map<string, { name: string | null; scarStartDate: string | null }>();

  if (Array.isArray(body.jobs)) {
    for (const job of body.jobs) {
      if (!job.communityCode) continue;
      jobMap.set(job.communityCode, {
        name: job.communityName || null,
        scarStartDate: job.scarStartDate || null,
      });
    }
  }

  if (builderId && jobMap.size) {
    for (const [code, meta] of jobMap.entries()) {
      await getCommunityId(code, meta.name ?? code);
    }
  }

  async function getCommunityId(code: string | null, friendlyName?: string | null) {
    if (!builderId || !code) return null;
    if (communityCache.has(code)) {
      return communityCache.get(code)!;
    }

    const targetName = friendlyName || code;

    const existing = await db.query.communities.findFirst({
      where: and(eq(communities.builderId, builderId), eq(communities.name, targetName)),
    });

    if (existing) {
      communityCache.set(code, existing.id);
      return existing.id;
    }

    if (friendlyName && friendlyName !== code) {
      const existingByCode = await db.query.communities.findFirst({
        where: and(eq(communities.builderId, builderId), eq(communities.name, code)),
      });

      if (existingByCode) {
        await db.update(communities)
          .set({ name: friendlyName })
          .where(eq(communities.id, existingByCode.id));
        communityCache.set(code, existingByCode.id);
        return existingByCode.id;
      }
    }

    const [row] = await db.insert(communities).values({
      builderId,
      name: targetName,
    }).returning();

    communityCache.set(code, row.id);
    return row.id;
  }

  async function getServiceId(code: string | null, name: string | null) {
    if (!code || !name) return null;
    if (serviceCache.has(code)) {
      return serviceCache.get(code)!;
    }

    const existing = await db.query.services.findFirst({
      where: eq(services.code, code),
    });

    if (existing) {
      if (existing.name !== name) {
        await db.update(services).set({ name }).where(eq(services.id, existing.id));
      }
      serviceCache.set(code, existing.id);
      return existing.id;
    }

    const [row] = await db.insert(services).values({
      code,
      name,
      unitKind: 'PER_JOB',
    }).returning();

    serviceCache.set(code, row.id);
    return row.id;
  }

  async function getModelPlanId(planNumber: string | null) {
    if (!builderId || !planNumber) return null;
    const key = planNumber.trim();
    if (!key) return null;

    if (modelPlanCache.has(key)) {
      return modelPlanCache.get(key) ?? null;
    }

    const existing = await db.query.modelPlans.findFirst({
      where: and(eq(modelPlans.builderId, builderId), eq(modelPlans.code, key)),
    });

    const value = existing?.id ?? null;
    modelPlanCache.set(key, value);
    return value;
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const jobNumberRaw = item.jobNumber?.trim() || null;
    const invoiceNumber = item.invoiceNumber?.trim();

    if (!invoiceNumber) {
      skipped++;
      continue;
    }

    const { communityCode, lot } = splitJobNumber(jobNumberRaw);
    const accountCategory = parseAccountCategory(item.accountCategory);
    const jobMeta = communityCode ? jobMap.get(communityCode) : null;
    const startDateValue =
      parseDate(jobMeta?.scarStartDate) ?? parseDate(item.startDate);
    const checkDateValue = parseDate(item.checkDate);
    const communityId = await getCommunityId(
      communityCode,
      jobMeta?.name ?? communityCode
    );
    const serviceId = await getServiceId(accountCategory.code, accountCategory.name);
    const modelPlanId = await getModelPlanId(item.planNumber);

    let existing = null;
    const candidateLots = [lot, jobNumberRaw].filter(Boolean) as string[];
    for (const candidate of candidateLots.length ? candidateLots : [null]) {
      const whereClauses = [
        eq(blueBookEntries.poNumber, invoiceNumber),
        ...(candidate ? [eq(blueBookEntries.lot, candidate)] : []),
      ];

      existing = await db.query.blueBookEntries.findFirst({
        where: whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses),
      });

      if (existing) break;
    }

    const amountString = Number.isFinite(item.lineAmount)
      ? item.lineAmount.toFixed(2)
      : '0.00';

    const status = item.completedDate ? 'COMPLETE' : 'PENDING';

    if (existing) {
      const updateValues = {
        lot: lot ?? jobNumberRaw,
        poNumber: invoiceNumber,
        status,
        amount: amountString,
        updatedAt: new Date(),
        accountCategoryCode: accountCategory.code,
        accountCategoryName: accountCategory.name,
        startDate: startDateValue,
        checkNumber: item.checkNumber?.trim() || null,
        checkDate: checkDateValue,
        checkTotal: Number.isFinite(item.checkTotal) ? item.checkTotal.toFixed(2) : null,
        isAch: !!item.isACH,
        ...(communityId ? { communityId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(builderId ? { builderId } : {}),
        ...(modelPlanId ? { modelPlanId } : {}),
      };

      await db
        .update(blueBookEntries)
        .set(updateValues)
        .where(eq(blueBookEntries.id, existing.id));
      updated++;
    } else {
      await db.insert(blueBookEntries).values({
        lot: lot ?? jobNumberRaw,
        poNumber: invoiceNumber,
        status,
        amount: amountString,
        updatedAt: new Date(),
        accountCategoryCode: accountCategory.code,
        accountCategoryName: accountCategory.name,
        startDate: startDateValue,
        checkNumber: item.checkNumber?.trim() || null,
        checkDate: checkDateValue,
        checkTotal: Number.isFinite(item.checkTotal) ? item.checkTotal.toFixed(2) : null,
        isAch: !!item.isACH,
        ...(communityId ? { communityId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(builderId ? { builderId } : {}),
        ...(modelPlanId ? { modelPlanId } : {}),
      });
      inserted++;
    }
  }

  return NextResponse.json({
    ok: true,
    start,
    end,
    inserted,
    updated,
    skipped,
  });
}

export const POST = withErrorHandling(handler);
