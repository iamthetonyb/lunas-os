import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { dispatchBatches } from '@/db/schema/dispatch_batches';
import { assignments } from '@/db/schema/assignments';
import { eq, count } from 'drizzle-orm';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');
        const db = await getDb();

        // Get all dispatch batches - filtered by date if provided
        let query = db.select({
            id: dispatchBatches.id,
            serviceDate: dispatchBatches.serviceDate,
            status: dispatchBatches.status,
            crewName: dispatchBatches.crewName,
            foremanName: dispatchBatches.foremanName,
            notes: dispatchBatches.notes,
        })
            .from(dispatchBatches);

        if (dateParam) {
            query = query.where(eq(dispatchBatches.serviceDate, dateParam)) as any;
        }

        const batches = await query;

        // For each batch, get job count
        const batchData = await Promise.all(batches.map(async (batch) => {
            // Count jobs (assignments) in this batch
            const jobCountResult = await db.select({
                count: count(),
            })
                .from(assignments)
                .where(eq(assignments.dispatchBatchId, batch.id));

            return {
                id: batch.id,
                serviceDate: batch.serviceDate,
                status: batch.status,
                crewName: batch.crewName || 'Unassigned Crew',
                foremanName: batch.foremanName || 'Unassigned',
                jobCount: Number(jobCountResult[0]?.count) || 0,
            };
        }));

        return json(batchData);
    } catch (error) {
        console.error('Error fetching dispatch batches:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to load dispatch batches' }, 500);
    }
}
