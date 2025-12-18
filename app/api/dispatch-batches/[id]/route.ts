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
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const db = await getDb();

        // Get the dispatch batch
        const batch = await db.select({
            id: dispatchBatches.id,
            serviceDate: dispatchBatches.serviceDate,
            status: dispatchBatches.status,
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

        // Get assignments linked to this batch with job details using explicit joins
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

        // Get crew and foreman info from first assignment
        const firstAssignment = batchAssignments[0];
        const crewName = firstAssignment?.crewName || 'Unknown Crew';
        const foremanName = firstAssignment?.foremanName || 'Unassigned';

        // Map jobs from assignments
        const jobs = batchAssignments.map((assignment) => ({
            id: assignment.jobRequestServiceId || assignment.assignmentId,
            communityName: assignment.communityName || null,
            builderName: assignment.builderName || null,
            lot: assignment.lot || null,
            address: assignment.address || null,
            serviceName: assignment.serviceName || null,
            walkTime: assignment.walkTime || null,
            status: assignment.assignmentStatus || 'PENDING',
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
