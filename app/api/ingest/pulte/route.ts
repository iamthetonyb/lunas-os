import { NextResponse } from 'next/server';
import { db } from '@/db';
import { blueBookEntries, builders, communities, services } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { withErrorHandling } from '@/lib/api-handler';

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
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
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

  async function getCommunityId(code: string | null) {
    if (!builderId || !code) return null;
    if (communityCache.has(code)) {
      return communityCache.get(code)!;
    }

    const existing = await db.query.communities.findFirst({
      where: and(eq(communities.builderId, builderId), eq(communities.name, code)),
    });

    if (existing) {
      communityCache.set(code, existing.id);
      return existing.id;
    }

    const [row] = await db.insert(communities).values({
      builderId,
      name: code,
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
    const startDateValue = parseDate(item.startDate);
    const communityId = await getCommunityId(communityCode);
    const serviceId = await getServiceId(accountCategory.code, accountCategory.name);

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
        ...(communityId ? { communityId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(builderId ? { builderId } : {}),
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
        ...(communityId ? { communityId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(builderId ? { builderId } : {}),
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
