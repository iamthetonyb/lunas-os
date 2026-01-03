import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { blueBookEntries, assignments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

/**
 * POST /api/schedule/complete
 * Mark a job as completed
 * Body: { jobId }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId } = body;

        if (!jobId) {
            return json({ ok: false, error: 'jobId is required' }, 400);
        }

        const db = await getDb();

        // Check current status
        const [current] = await db
            .select({ status: blueBookEntries.status })
            .from(blueBookEntries)
            .where(eq(blueBookEntries.id, jobId));

        const newStatus = current?.status === 'COMPLETE' ? 'PENDING' : 'COMPLETE';

        // Update blue book entry status
        await db
            .update(blueBookEntries)
            .set({
                status: newStatus,
                updatedAt: new Date(),
            })
            .where(eq(blueBookEntries.id, jobId));

        // Crtical fix: Update assignment status explicitly
        // Map BlueBook PENDING status to assignment IN_PROGRESS (or similar valid status)
        const assignmentStatus = newStatus === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETE';

        await db.update(assignments)
            .set({ status: assignmentStatus })
            .where(eq(assignments.blueBookEntryId, jobId));

        // Publish event for realtime updates (Critical Fix)
        const rest = await import('@/lib/ably').then(m => m.getAblyRest());
        if (rest) {
            await rest.channels.get('schedule').publish('update', {
                id: jobId,
                status: newStatus
            });
        }

        return json({
            ok: true,
            status: newStatus,
            message: `Job marked as ${newStatus}`,
        });
    } catch (error) {
        console.error('Error completing job:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to complete job' }, 500);
    }
}
