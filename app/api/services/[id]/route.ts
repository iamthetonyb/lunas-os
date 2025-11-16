import { getDb } from '@/lib/db/get-db';
import { services } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@/lib/utils/json';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const data = await req.json();
    const [updatedService] = await db
      .update(services)
      .set(data)
      .where(eq(services.id, params.id))
      .returning();
    return json(updatedService ?? null);
  } catch (error) {
    console.error('Error updating service:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to update service' }, 500);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    await db.delete(services).where(eq(services.id, params.id));
    return json({ ok: true }, 200);
  } catch (error) {
    console.error('Error deleting service:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to delete service' }, 500);
  }
}
