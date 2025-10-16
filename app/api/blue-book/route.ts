import { db } from '@/db';
import { blueBookEntries } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const builderId = searchParams.get('builderId');
  const status = searchParams.get('status');
  const invoiced = searchParams.get('invoiced');

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

  const where = and(...conditions);

  const entries = await db.query.blueBookEntries.findMany({ where });
  return NextResponse.json(entries);
}
