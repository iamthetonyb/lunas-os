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

        // Update blue book entry status to COMPLETE
        await db
            .update(blueBookEntries)
            .set({
                status: 'COMPLETE',
                updatedAt: new Date(),
            })
            .where(eq(blueBookEntries.id, jobId));

        return json({
            ok: true,
            message: 'Job marked as complete',
        });
    } catch (error) {
        console.error('Error completing job:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to complete job' }, 500);
    }
}
