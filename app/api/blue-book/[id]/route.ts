import { getDb } from '@/lib/db/get-db';
import { blueBookEntries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@/lib/utils/json';

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
  modelPlanId?: string | null;
};

function normalizeDate(input?: string | null) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDb();
    const params = await paramsPromise;

    if (!params.id) {
      return json({ ok: false, error: 'Missing entry id' }, 400);
    }

    const body = (await req.json()) as PatchBody;
    const updates: Partial<typeof blueBookEntries.$inferInsert> = {};

    if ('lot' in body) updates.lot = body.lot?.trim() || null;
    if ('startDate' in body) updates.startDate = normalizeDate(body.startDate);
    if ('status' in body && body.status && ['COMPLETE', 'PENDING'].includes(body.status)) {
      updates.status = body.status as 'COMPLETE' | 'PENDING';
    }
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
    if ('modelPlanId' in body) {
      updates.modelPlanId = body.modelPlanId ?? null;
    }

    if (Object.keys(updates).length === 0) {
      return json({ ok: false, error: 'No updates provided' }, 400);
    }

    updates.updatedAt = new Date();

    const result = await db
      .update(blueBookEntries)
      .set(updates)
      .where(eq(blueBookEntries.id, params.id))
      .returning();

    if (!result.length) {
      return json({ ok: false, error: 'Entry not found' }, 404);
    }

    return json({ ok: true, entry: result[0] });
  } catch (error) {
    console.error('Error updating blue book entry:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to update entry' }, 500);
  }
}

export async function DELETE(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDb();
    const params = await paramsPromise;

    if (!params.id) {
      return json({ ok: false, error: 'Missing entry id' }, 400);
    }

    // Check if entry exists (no source restriction - authorized users can delete any entry)
    const existing = await db
      .select({ id: blueBookEntries.id })
      .from(blueBookEntries)
      .where(eq(blueBookEntries.id, params.id))
      .limit(1);

    if (!existing.length) {
      return json({ ok: false, error: 'Entry not found' }, 404);
    }

    try {
      await db
        .delete(blueBookEntries)
        .where(eq(blueBookEntries.id, params.id))
        .returning();

      return json({ ok: true, message: 'Entry deleted successfully' });
    } catch (deleteError: any) {
      // Check for foreign key constraint violation
      if (deleteError.message?.includes('foreign key constraint') || deleteError.code === '23503') {
        return json({ ok: false, error: 'Cannot delete entry because it is linked to an active assignment. Remove dispatch first.' }, 400);
      }
      throw deleteError;
    }
  } catch (error) {
    console.error('Error deleting blue book entry:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to delete entry' }, 500);
  }
}
