import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { dispatchBatches } from '@/db/schema/dispatch_batches';
import { assignments } from '@/db/schema/assignments';
import { jobRequestServices } from '@/db/schema/job_request_services';
import { jobRequests } from '@/db/schema/job_requests';
import { communities } from '@/db/schema/communities';
import { builders } from '@/db/schema/builders';
import { services } from '@/db/schema/services';
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

        // Get assignments linked to this batch with job details
        const batchAssignments = await db.query.assignments.findMany({
            where: eq(assignments.dispatchBatchId, id),
            with: {
                crew: {
                    with: {
                        foreman: true,
                    },
                },
                jobRequestService: {
                    with: {
                        service: true,
                        jobRequest: {
                            with: {
                                community: true,
                                builder: true,
                            },
                        },
                    },
                },
            },
        });

        // Get crew and foreman info from first assignment
        const firstAssignment = batchAssignments[0];
        const crewName = (firstAssignment as any)?.crew?.name || 'Unknown Crew';
        const foremanName = (firstAssignment as any)?.crew?.foreman?.name || 'Unknown';

        // Map jobs from assignments
        const jobs = batchAssignments.map((assignment: any) => {
            const jrs = assignment.jobRequestService;
            const jr = jrs?.jobRequest;

            return {
                id: jrs?.id || assignment.id,
                communityName: jr?.community?.name || null,
                builderName: jr?.builder?.name || null,
                lot: jr?.lot || null,
                address: jr?.address || null,
                serviceName: jrs?.service?.name || null,
                walkTime: jrs?.walkTime || null,
                dueDate: jr?.dueDate || null,
                status: assignment.status || 'PENDING',
            };
        });

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
