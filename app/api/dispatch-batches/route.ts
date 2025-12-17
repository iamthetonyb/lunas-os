
import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { dispatchBatches } from '@/db/schema/dispatch_batches';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET() {
    try {
        const db = await getDb();

        // Fetch batches with creator info
        // Note: Schema currently doesn't link directly to crew/foreman other than createdBy
        // We will return what we have. Future enhancement needed to link to specific crew if not 'createdBy'
        const batches = await db.select({
            id: dispatchBatches.id,
            serviceDate: dispatchBatches.serviceDate,
            status: dispatchBatches.status,
            notes: dispatchBatches.notes,
            createdById: dispatchBatches.createdById,
            creatorName: users.name,
        })
            .from(dispatchBatches)
            .leftJoin(users, eq(dispatchBatches.createdById, users.id));

        const formattedBatches = batches.map(batch => ({
            id: batch.id,
            serviceDate: batch.serviceDate,
            status: batch.status,
            // For now, mapping creator to foremanName/crewName as best effort placeholder
            // pending schema update to explicit crew/foreman columns
            foremanName: batch.creatorName,
            crewName: `Dispatch ${batch.id.substring(0, 8)}`, // Placeholder
            jobCount: 0 // Placeholder until we join with dispatched items
        }));

        return json(formattedBatches);
    } catch (error) {
        console.error('Error fetching dispatch batches:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to load dispatch batches' }, 500);
    }
}
