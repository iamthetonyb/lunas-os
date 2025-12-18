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

        // 1. Handle Blue Book Entry
        try {
            const entry = await db.query.blueBookEntries.findFirst({
                where: eq(blueBookEntries.id, jobId)
            });

            if (entry) {
                await db
                    .update(blueBookEntries)
                    .set({
                        startDate: newDate,
                        // Set original date if it's the first time rescheduling
                        originalStartDate: entry.originalStartDate || entry.startDate || null,
                        updatedAt: new Date(),
                    })
                    .where(eq(blueBookEntries.id, jobId));
            }
        } catch (err) {
            console.error('Error updating blue book entry in reschedule:', err);
        }

        // 2. Handle Job Request
        try {
            const request = await db.query.jobRequests.findFirst({
                where: eq(jobRequests.id, jobId)
            });

            if (request) {
                await db
                    .update(jobRequests)
                    .set({
                        dueDate: newDate,
                        originalDueDate: request.originalDueDate || request.dueDate || null,
                    })
                    .where(eq(jobRequests.id, jobId));
            } else {
                // If ID is a jobRequestServiceId, find the parent jobRequest
                const service = await db.query.jobRequestServices.findFirst({
                    where: eq(jobRequestServices.id, jobId)
                });

                if (service?.jobRequestId) {
                    const parentRequest = await db.query.jobRequests.findFirst({
                        where: eq(jobRequests.id, service.jobRequestId)
                    });

                    if (parentRequest) {
                        await db
                            .update(jobRequests)
                            .set({
                                dueDate: newDate,
                                originalDueDate: parentRequest.originalDueDate || parentRequest.dueDate || null,
                            })
                            .where(eq(jobRequests.id, service.jobRequestId));
                    }
                }
            }
        } catch (err) {
            console.error('Error updating job request in reschedule:', err);
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
