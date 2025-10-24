import { db } from '@/db';
import { blueBookEntries } from '@/db/schema';
import { and, eq, isNull, count, like, or, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api-handler';

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const builderId = searchParams.get('builderId');
  const status = searchParams.get('status');
  const invoiced = searchParams.get('invoiced');
  const searchTerm = searchParams.get('search')?.trim();
  const sortParam = (searchParams.get('sort') || 'checkDate').toLowerCase();
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
  if (status) {
    conditions.push(eq(blueBookEntries.status, status as any));
  }
  if (invoiced === 'false') {
    conditions.push(isNull(blueBookEntries.invoiceLineId));
  }
  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    conditions.push(
      or(
        like(blueBookEntries.lot, pattern),
        like(blueBookEntries.poNumber, pattern),
        like(blueBookEntries.accountCategoryName, pattern),
        like(blueBookEntries.accountCategoryCode, pattern),
        like(blueBookEntries.checkNumber, pattern)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderByClauses =
    sortParam === 'startdate'
      ? [
          desc(blueBookEntries.checkDate),
          desc(blueBookEntries.startDate),
          desc(blueBookEntries.createdAt),
        ]
      : [
          desc(blueBookEntries.checkDate),
          desc(blueBookEntries.startDate),
          desc(blueBookEntries.createdAt),
        ];

  const entries = await db.query.blueBookEntries.findMany({
    where,
    with: {
      builder: true,
      community: true,
      service: true,
    },
    orderBy: orderByClauses,
    ...(isPaginated ? { limit: pageSize, offset } : {}),
  });

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
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));

  if (isPaginated) {
    const totalQuery = db.select({ value: count() }).from(blueBookEntries);
    const totalResult = where ? await totalQuery.where(where) : await totalQuery;
    const total = Number(totalResult?.[0]?.value ?? 0);

    return NextResponse.json({
      page,
      pageSize,
      total,
      entries: formatted,
    });
  }

  return NextResponse.json(formatted);
}

export const GET = withErrorHandling(handler);
