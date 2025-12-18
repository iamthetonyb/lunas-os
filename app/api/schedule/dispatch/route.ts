import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { assignments, crews, dispatchBatches, blueBookEntries, jobRequestServices } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

/**
 * POST /api/schedule/dispatch
 * Dispatch a job to a foreman and crew
 * Body: { jobId, foremanName, crewName }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId, foremanName, crewName } = body;

        if (!jobId || !foremanName || !crewName) {
            return json({ ok: false, error: 'jobId, foremanName, and crewName are required' }, 400);
        }

        const db = await getDb();
        const today = new Date().toISOString().split('T')[0];

        // Find or create crew by name
        const existingCrews = await db.select().from(crews);
        let crew = existingCrews.find((c) => c.name?.toLowerCase() === crewName.toLowerCase());

        if (!crew) {
            const [newCrew] = await db
                .insert(crews)
                .values({ name: crewName })
                .returning();
            crew = newCrew;
        }

        // Always create a new dispatch batch for this job with the correct crew/foreman
        const [newBatch] = await db
            .insert(dispatchBatches)
            .values({
                serviceDate: today,
                status: 'SENT',
                crewName: crewName,
                foremanName: foremanName,
            })
            .returning();

        // Create assignment linking job to batch
        await db.insert(assignments).values({
            dispatchBatchId: newBatch.id,
            crewId: crew.id,
            status: 'SENT',
        });

        // Update job_request_services if it's a job request service ID
        try {
            await db
                .update(jobRequestServices)
                .set({
                    assignedForemanName: foremanName,
                })
                .where(eq(jobRequestServices.id, jobId));
        } catch {
            // May not be a job request service ID, try blue book
        }

        // Update blue book entry status if applicable
        try {
            await db
                .update(blueBookEntries)
                .set({
                    status: 'PENDING',
                    updatedAt: new Date(),
                })
                .where(eq(blueBookEntries.id, jobId));
        } catch {
            // May not be a blue book entry
        }

        return json({
            ok: true,
            message: `Job dispatched to ${foremanName} / ${crewName}`,
            crewId: crew.id,
            batchId: newBatch.id,
        });
    } catch (error) {
        console.error('Error dispatching job:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to dispatch job' }, 500);
    }
}
