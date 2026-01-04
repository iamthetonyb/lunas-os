import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { dispatchBatches } from '@/db/schema/dispatch_batches';
import { assignments } from '@/db/schema/assignments';
import { jobRequestServices } from '@/db/schema/job_request_services';
import { jobRequests } from '@/db/schema/job_requests';
import { communities } from '@/db/schema/communities';
import { builders } from '@/db/schema/builders';
import { services } from '@/db/schema/services';
import { crews } from '@/db/schema/crews';
import { users } from '@/db/schema/users';
import { eq, sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const db = await getDb();

        const batch = await db.select({
            id: dispatchBatches.id,
            serviceDate: dispatchBatches.serviceDate,
            status: dispatchBatches.status,
            crewName: dispatchBatches.crewName,
            foremanName: dispatchBatches.foremanName,
            notes: dispatchBatches.notes,
            createdById: dispatchBatches.createdById,
        })
            .from(dispatchBatches)
            .where(eq(dispatchBatches.id, id))
            .limit(1);

        if (!batch || batch.length === 0) {
            return json({ error: 'Dispatch batch not found' }, 404);
        }

        const dispatchBatch = batch[0];

        const batchAssignments = await db.select({
            assignmentId: assignments.id,
            assignmentStatus: assignments.status,
            crewId: assignments.crewId,
            crewName: crews.name,
            foremanId: crews.foremanId,
            foremanName: users.name,
            jobRequestServiceId: assignments.jobRequestServiceId,
            serviceName: services.name,
            walkTime: jobRequestServices.walkTime,
            jobRequestId: jobRequestServices.jobRequestId,
            communityName: communities.name,
            builderName: builders.name,
            lot: jobRequests.lot,
            address: jobRequests.address,
            serviceForeman: jobRequestServices.assignedForemanName,
        })
            .from(assignments)
            .leftJoin(crews, eq(assignments.crewId, crews.id))
            .leftJoin(users, eq(crews.foremanId, users.id))
            .leftJoin(jobRequestServices, eq(assignments.jobRequestServiceId, jobRequestServices.id))
            .leftJoin(services, eq(jobRequestServices.serviceId, services.id))
            .leftJoin(jobRequests, eq(jobRequestServices.jobRequestId, jobRequests.id))
            .leftJoin(communities, eq(jobRequests.communityId, communities.id))
            .leftJoin(builders, eq(jobRequests.builderId, builders.id))
            .where(eq(assignments.dispatchBatchId, id));

        const crewName = dispatchBatch.crewName || batchAssignments[0]?.crewName || 'Unknown Crew';
        const foremanName = dispatchBatch.foremanName || batchAssignments[0]?.foremanName || 'Unassigned';

        const jobs = batchAssignments.map((assignment) => ({
            id: assignment.assignmentId,
            communityName: assignment.communityName || null,
            builderName: assignment.builderName || null,
            lot: assignment.lot || null,
            address: assignment.address || null,
            serviceName: assignment.serviceName || null,
            walkTime: assignment.walkTime || null,
            status: assignment.assignmentStatus || 'PENDING',
            assignedForeman: assignment.serviceForeman || foremanName,
        }));

        return json({
            id: dispatchBatch.id,
            serviceDate: dispatchBatch.serviceDate,
            status: dispatchBatch.status,
            notes: dispatchBatch.notes,
            crewName,
            foremanName,
            jobs,
        });
    } catch (error) {
        console.error('Error fetching dispatch batch detail:', error);
        return json({ error: (error as Error).message ?? 'Failed to load dispatch batch' }, 500);
    }
}

// THE FIXED DELETE FUNCTION (Using Raw SQL for Safety)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const db = await getDb();

        // Use a transaction or sequential SQL execution to ensure order
        // 1. Delete Blue Book Entries linked to assignments in this batch
        await db.execute(sql`
            DELETE FROM blue_book_entries 
            WHERE assignment_id IN (
                SELECT id FROM assignments WHERE dispatch_batch_id = ${id}
            )
        `);

        // 2. Delete the Assignments
        await db.execute(sql`
            DELETE FROM assignments 
            WHERE dispatch_batch_id = ${id}
        `);

        // 3. Delete the Batch itself
        await db.execute(sql`
            DELETE FROM dispatch_batches 
            WHERE id = ${id}
        `);

        return json({ ok: true, message: 'Dispatch batch deleted' });
    } catch (error) {
        console.error('Error deleting dispatch batch:', error);
        return json({ error: (error as Error).message ?? 'Failed to delete dispatch batch' }, 500);
    }
}