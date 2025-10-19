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

  const entries = await db.query.blueBookEntries.findMany({
    where: and(
      isNotNull(blueBookEntries.startDate),
      gte(blueBookEntries.startDate, new Date(formatDateInput(startDate))),
      lte(blueBookEntries.startDate, new Date(formatDateInput(endDate)))
    ),
    with: {
      builder: true,
      community: true,
      service: true,
    },
    orderBy: (entries, { asc }) => asc(blueBookEntries.startDate),
  });

  const formatted = entries.map((entry) => ({
    id: entry.id,
    startDate: entry.startDate,
    builderName: entry.builder?.name ?? null,
    communityName: entry.community?.name ?? null,
    lot: entry.lot,
    serviceName: entry.service?.name ?? entry.accountCategoryName ?? null,
    accountCategoryCode: entry.accountCategoryCode,
    accountCategoryName: entry.accountCategoryName,
    invoiceNumber: entry.poNumber,
    amount: entry.amount,
    status: entry.status,
  }));

  return NextResponse.json(formatted);
}
