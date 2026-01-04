import { getDb } from '@/lib/db/get-db';
import { assignments, blueBookEntries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@/lib/utils/json';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

// Handle Promise params per Next.js 16 dynamic route requirements
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const db = await getDb();
    const assignment = await db.query.assignments.findFirst({
      where: eq(assignments.id, id),
    });

    if (!assignment) {
      return json({ ok: false, error: 'Assignment not found' }, 404);
    }

    return json(assignment);
  } catch (error) {
    console.error('Error fetching assignment:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to load assignment' }, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const db = await getDb();
    const [assignment] = await db.select({ dispatchBatchId: assignments.dispatchBatchId }).from(assignments).where(eq(assignments.id, id)).limit(1);

    // 1. DELETE FROM blue_book_entries WHERE assignment_id = [id]
    await db.delete(blueBookEntries).where(eq(blueBookEntries.assignmentId, id));

    // 2. Delete Assignment
    await db.delete(assignments).where(eq(assignments.id, id));

    // 3. Zombie Batch Check: If no assignments remain for this batch, delete it
    if (assignment?.dispatchBatchId) {
      const remaining = await db.select({ id: assignments.id }).from(assignments).where(eq(assignments.dispatchBatchId, assignment.dispatchBatchId));
      if (remaining.length === 0) {
        const { dispatchBatches } = await import('@/db/schema');
        await db.delete(dispatchBatches).where(eq(dispatchBatches.id, assignment.dispatchBatchId));
      }
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to delete assignment' }, 500);
  }
}
