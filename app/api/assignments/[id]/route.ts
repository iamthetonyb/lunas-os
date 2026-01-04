import { getDb } from '@/lib/db/get-db';
import { assignments, blueBookEntries, fieldTickets, invoiceLines, dispatchBatches } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
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

    // Get assignment details first to know the batch
    const [assignment] = await db
      .select({ dispatchBatchId: assignments.dispatchBatchId })
      .from(assignments)
      .where(eq(assignments.id, id))
      .limit(1);

    if (!assignment) {
      return json({ ok: true }); // Already gone or never existed
    }

    await db.transaction(async (tx) => {
      // 1. Find Blue Book Entry IDs to clean up Invoice Lines
      const bbeRows = await tx
        .select({ id: blueBookEntries.id })
        .from(blueBookEntries)
        .where(eq(blueBookEntries.assignmentId, id));

      const bbeIds = bbeRows.map(r => r.id);

      // 2. DELETE FROM invoice_lines WHERE blue_book_id IN (...)
      if (bbeIds.length > 0) {
        await tx.delete(invoiceLines).where(inArray(invoiceLines.blueBookId, bbeIds));
      }

      // 3. DELETE FROM blue_book_entries WHERE assignment_id = [id]
      await tx.delete(blueBookEntries).where(eq(blueBookEntries.assignmentId, id));

      // 4. DELETE FROM field_tickets WHERE assignment_id = [id]
      await tx.delete(fieldTickets).where(eq(fieldTickets.assignmentId, id));

      // 5. Delete Assignment
      await tx.delete(assignments).where(eq(assignments.id, id));

      // 6. Zombie Batch Check: If no assignments remain for this batch, delete it
      if (assignment.dispatchBatchId) {
        const remaining = await tx
          .select({ id: assignments.id })
          .from(assignments)
          .where(eq(assignments.dispatchBatchId, assignment.dispatchBatchId))
          .limit(1);

        if (remaining.length === 0) {
          await tx.delete(dispatchBatches).where(eq(dispatchBatches.id, assignment.dispatchBatchId));
        }
      }
    });

    return json({ ok: true });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to delete assignment' }, 500);
  }
}
