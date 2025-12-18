import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { dispatchBatches } from '@/db/schema/dispatch_batches';
import { assignments } from '@/db/schema/assignments';
import { crews } from '@/db/schema/crews';
import { users } from '@/db/schema/users';
import { eq, sql, count } from 'drizzle-orm';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET() {
    try {
        const db = await getDb();

        // Get all dispatch batches with crew and foreman info via assignments
        const batches = await db.select({
            id: dispatchBatches.id,
            serviceDate: dispatchBatches.serviceDate,
            status: dispatchBatches.status,
            notes: dispatchBatches.notes,
            createdById: dispatchBatches.createdById,
        })
            .from(dispatchBatches);

        // For each batch, get crew info and job count
        const batchData = await Promise.all(batches.map(async (batch) => {
            // Get assignments for this batch with crew info
            const batchAssignments = await db.select({
                crewName: crews.name,
                foremanName: users.name,
            })
                .from(assignments)
                .leftJoin(crews, eq(assignments.crewId, crews.id))
                .leftJoin(users, eq(crews.foremanId, users.id))
                .where(eq(assignments.dispatchBatchId, batch.id))
                .limit(1);

            // Count jobs in this batch
            const jobCountResult = await db.select({
                count: count(),
            })
                .from(assignments)
                .where(eq(assignments.dispatchBatchId, batch.id));

            const firstAssignment = batchAssignments[0];

            return {
                id: batch.id,
                serviceDate: batch.serviceDate,
                status: batch.status,
                crewName: firstAssignment?.crewName || 'Unassigned Crew',
                foremanName: firstAssignment?.foremanName || 'Unassigned',
                jobCount: Number(jobCountResult[0]?.count) || 0,
            };
        }));

        return json(batchData);
    } catch (error) {
        console.error('Error fetching dispatch batches:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to load dispatch batches' }, 500);
    }
}
