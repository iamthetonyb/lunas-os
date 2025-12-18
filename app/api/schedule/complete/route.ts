import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { blueBookEntries } from '@/db/schema';
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

        // Publish event for realtime updates
        const { publishOrgEvent } = await import('@/lib/ably');
        // We'll need to get orgId somehow, possibly from header or pass it in body if not in session context here
        // For now, let's rely on the client refreshing, or better: publish if we can.
        // But since this is a protected route usually valid with session...
        // Let's just return success and let client re-fetch.

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
