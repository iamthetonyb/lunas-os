import { getDb } from '@/lib/db/get-db';
import { contractRates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@/lib/utils/json';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const db = await getDb();
    const data = await req.json();
    const [updatedRate] = await db
      .update(contractRates)
      .set(data)
      .where(eq(contractRates.id, id))
      .returning();
    return json(updatedRate ?? null);
  } catch (error) {
    console.error('Error updating contract rate:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to update contract rate' }, 500);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const db = await getDb();
    await db.delete(contractRates).where(eq(contractRates.id, id));
    return json({ ok: true }, 200);
  } catch (error) {
    console.error('Error deleting contract rate:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to delete contract rate' }, 500);
  }
}
