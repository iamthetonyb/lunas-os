import { getDb } from '@/lib/db/get-db';
import { services } from '@/db/schema';
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
    const [updatedService] = await db
      .update(services)
      .set(data)
      .where(eq(services.id, id))
      .returning();
    return json(updatedService ?? null);
  } catch (error) {
    console.error('Error updating service:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to update service' }, 500);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const db = await getDb();

    // Soft delete
    await db.update(services)
      .set({ active: false })
      .where(eq(services.id, id));

    return json({ ok: true }, 200);
  } catch (error) {
    console.error('Error deleting service:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to delete service' }, 500);
  }
}
