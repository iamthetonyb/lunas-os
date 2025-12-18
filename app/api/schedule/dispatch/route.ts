import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { assignments, crews, dispatchBatches, blueBookEntries } from '@/db/schema';
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

        // Find or create crew by name
        const existingCrews = await db.select().from(crews);
        let crew = existingCrews.find((c) => c.name?.toLowerCase() === crewName.toLowerCase());

        if (!crew) {
            // Create a new crew entry with the name
            const [newCrew] = await db
                .insert(crews)
                .values({
                    name: crewName,
                })
                .returning();
            crew = newCrew;
        }

        // Create or get dispatch batch for today
        const today = new Date().toISOString().split('T')[0];
        const existingBatches = await db.select().from(dispatchBatches);
        let batch = existingBatches.find((b) =>
            b.serviceDate === today && b.status === 'DRAFT'
        );

        if (!batch) {
            const [newBatch] = await db
                .insert(dispatchBatches)
                .values({
                    serviceDate: today,
                    status: 'SENT', // Mark as sent when dispatching
                    crewName: crewName,
                    foremanName: foremanName,
                })
                .returning();
            batch = newBatch;
        }

        // Update the blue book entry status (PENDING -> COMPLETE when dispatched)
        // Note: Schema only allows PENDING or COMPLETE
        await db
            .update(blueBookEntries)
            .set({
                status: 'PENDING', // Keep as pending until marked complete
                updatedAt: new Date(),
            })
            .where(eq(blueBookEntries.id, jobId));

        return json({
            ok: true,
            message: `Job dispatched to ${foremanName} / ${crewName}`,
            crewId: crew.id,
            batchId: batch.id,
        });
    } catch (error) {
        console.error('Error dispatching job:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to dispatch job' }, 500);
    }
}
