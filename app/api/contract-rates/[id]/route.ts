import { getDb } from '@/lib/db/get-db';
import { contractRates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@/lib/utils/json';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const data = await req.json();
    const [updatedRate] = await db
      .update(contractRates)
      .set(data)
      .where(eq(contractRates.id, params.id))
      .returning();
    return json(updatedRate ?? null);
  } catch (error) {
    console.error('Error updating contract rate:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to update contract rate' }, 500);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    await db.delete(contractRates).where(eq(contractRates.id, params.id));
    return json({ ok: true }, 200);
  } catch (error) {
    console.error('Error deleting contract rate:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to delete contract rate' }, 500);
  }
}
