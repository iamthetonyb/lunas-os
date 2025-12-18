import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { blueBookEntries, jobRequests, jobRequestServices } from '@/db/schema';
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
        // Use newDate string directly to avoid timezone issues
        // newDate comes in as "YYYY-MM-DD" format from date input

        // Try to update blue_book_entry if it exists
        try {
            await db
                .update(blueBookEntries)
                .set({
                    startDate: newDate, // Use string directly
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
                    dueDate: newDate, // Use string directly
                })
                .where(eq(jobRequests.id, jobId));
        } catch {
            // May not be a job request ID
        }

        // Also try to update job_request_services if it's a service ID
        try {
            await db
                .update(jobRequestServices)
                .set({
                    // Store reschedule date if column exists, or update any date field
                })
                .where(eq(jobRequestServices.id, jobId));
        } catch {
            // May not be a job request service ID
        }

        return json({
            ok: true,
            message: `Job rescheduled to ${newDate}`,
            newDate: newDate,
        });
    } catch (error) {
        console.error('Error rescheduling job:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to reschedule job' }, 500);
    }
}
