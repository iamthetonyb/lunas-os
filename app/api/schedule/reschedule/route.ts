import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { blueBookEntries, jobRequests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

/**
 * POST /api/schedule/reschedule
 * Reschedule a job to a new date
 * Body: { jobId, newDate }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId, newDate } = body;

        if (!jobId || !newDate) {
            return json({ ok: false, error: 'jobId and newDate are required' }, 400);
        }

        const db = await getDb();
        const parsedDate = new Date(newDate);

        // Try to update blue_book_entry if it exists
        // Keep as PENDING (can't use RESCHEDULED - not in enum)
        try {
            await db
                .update(blueBookEntries)
                .set({
                    startDate: newDate, // Update the start date to new date
                    updatedAt: new Date(),
                })
                .where(eq(blueBookEntries.id, jobId));
        } catch {
            // May not be a blue book entry ID
        }

        // Also try to update job_request if it exists
        try {
            await db
                .update(jobRequests)
                .set({
                    dueDate: parsedDate.toISOString().split('T')[0], // Use string format for date
                })
                .where(eq(jobRequests.id, jobId));
        } catch {
            // May not be a job request ID
        }

        return json({
            ok: true,
            message: `Job rescheduled to ${newDate}`,
            newDate: parsedDate.toISOString(),
        });
    } catch (error) {
        console.error('Error rescheduling job:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to reschedule job' }, 500);
    }
}
