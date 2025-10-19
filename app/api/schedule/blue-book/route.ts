import { NextResponse } from 'next/server';
import { db } from '@/db';
import { blueBookEntries } from '@/db/schema';
import { and, gte, lte, isNotNull } from 'drizzle-orm';

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

function formatDateInput(date: Date) {
  return date.toISOString().split('T')[0];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const startDate = parseDateParam(searchParams.get('start'), now);
  const defaultEnd = new Date(startDate);
  defaultEnd.setDate(defaultEnd.getDate() + 14);
  const endDate = parseDateParam(searchParams.get('end'), defaultEnd);

  const startIso = formatDateInput(startDate);
  const endIso = formatDateInput(endDate);

  const entries = await db.query.blueBookEntries.findMany({
    where: and(
      isNotNull(blueBookEntries.startDate),
      gte(blueBookEntries.startDate, startIso),
      lte(blueBookEntries.startDate, endIso)
    ),
    with: {
      builder: true,
      community: true,
      service: true,
    },
    orderBy: (entries, { asc }) => asc(blueBookEntries.startDate),
  });

  const formatted = entries.map((entry) => {
    const builderName = entry.builder?.name ?? null;
    const communityName = entry.community?.name ?? null;
    const serviceName = entry.service?.name ?? entry.accountCategoryName ?? null;
    const accountCategoryName = entry.accountCategoryName ?? entry.service?.name ?? null;
    const communityCode = communityName ?? entry.communityId;
    const jobNumber =
      communityCode && entry.lot
        ? `${communityCode}-${entry.lot}`
        : entry.lot || communityCode || null;

    return {
      id: entry.id,
      startDate: entry.startDate,
      builderName,
      communityName,
      lot: entry.lot,
      contractorName: accountCategoryName,
      serviceName,
      jobNumber,
      accountCategoryCode: entry.accountCategoryCode,
      invoiceNumber: entry.poNumber,
      amount: entry.amount,
      status: entry.status,
    };
  });

  return NextResponse.json(formatted);
}
