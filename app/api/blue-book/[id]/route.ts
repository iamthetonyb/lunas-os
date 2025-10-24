import { NextResponse } from 'next/server';
import { db } from '@/db';
import { blueBookEntries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withErrorHandling } from '@/lib/api-handler';

type PatchBody = {
  lot?: string | null;
  startDate?: string | null;
  status?: string | null;
  invoiceNumber?: string | null;
  amount?: number | string | null;
  accountCategoryName?: string | null;
  accountCategoryCode?: string | null;
  checkNumber?: string | null;
  checkDate?: string | null;
};

function normalizeDate(input?: string | null) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

async function handler(req: Request, { params }: { params: { id: string } }) {
  if (!params.id) {
    return NextResponse.json({ error: 'Missing entry id' }, { status: 400 });
  }

  const body = (await req.json()) as PatchBody;
  const updates: Record<string, any> = {};

  if ('lot' in body) updates.lot = body.lot?.trim() || null;
  if ('startDate' in body) updates.startDate = normalizeDate(body.startDate);
  if ('status' in body && body.status) updates.status = body.status;
  if ('invoiceNumber' in body) updates.poNumber = body.invoiceNumber?.trim() || null;
  if ('amount' in body) {
    const amountNumber = typeof body.amount === 'string' ? Number(body.amount) : body.amount;
    updates.amount =
      typeof amountNumber === 'number' && Number.isFinite(amountNumber)
        ? amountNumber.toFixed(2)
        : null;
  }
  if ('accountCategoryName' in body) {
    updates.accountCategoryName = body.accountCategoryName?.trim() || null;
  }
  if ('accountCategoryCode' in body) {
    updates.accountCategoryCode = body.accountCategoryCode?.trim() || null;
  }
  if ('checkNumber' in body) {
    updates.checkNumber = body.checkNumber?.trim() || null;
  }
  if ('checkDate' in body) {
    updates.checkDate = normalizeDate(body.checkDate);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  updates.updatedAt = new Date();

  const result = await db
    .update(blueBookEntries)
    .set(updates)
    .where(eq(blueBookEntries.id, params.id))
    .returning();

  if (!result.length) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, entry: result[0] });
}

export const PATCH = withErrorHandling(handler);
