import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { assignments, crews, dispatchBatches, blueBookEntries, jobRequestServices, jobRequests } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { requireMembership } from '@/lib/auth/guards';
import { publishOrgEvent } from '@/lib/ably';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

/**
 * POST /api/schedule/dispatch
 * Dispatch a job to a foreman and crew
 * Body: { jobId, foremanName, crewName }
 */
export async function POST(request: NextRequest) {
    try {
        const membership = await requireMembership(['admin', 'backoffice', 'contractor']);
        const body = await request.json();
        const { jobId, foremanName, crewName, serviceDate } = body;

        if (!jobId || !foremanName || !crewName) {
            return json({ ok: false, error: 'jobId, foremanName, and crewName are required' }, 400);
        }

        const db = await getDb();
        // Use provided serviceDate (from job's due date) or fall back to today
        const batchServiceDate = serviceDate || new Date().toISOString().split('T')[0];

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

        // Check if a batch already exists for this crew/foreman on this service date
        const existingBatch = await db.query.dispatchBatches.findFirst({
            where: and(
                eq(dispatchBatches.serviceDate, batchServiceDate),
                eq(dispatchBatches.crewName, crewName),
                eq(dispatchBatches.foremanName, foremanName),
                eq(dispatchBatches.status, 'SENT')
            )
        });

        let batchId: string;
        if (existingBatch) {
            batchId = existingBatch.id;
        } else {
            const [newBatch] = await db
                .insert(dispatchBatches)
                .values({
                    serviceDate: batchServiceDate,
                    status: 'SENT',
                    crewName: crewName,
                    foremanName: foremanName,
                    createdById: membership.userId,
                })
                .returning();
            batchId = newBatch.id;
        }

        // Create assignment linking job to batch
        // We need to determine if jobId belongs to jobRequestServices or blueBookEntries
        // Simplified fetch: just check existence and get minimal data
        const [jrs, bbe] = await Promise.all([
            db.select({ id: jobRequestServices.id, jobRequestId: jobRequestServices.jobRequestId, serviceId: jobRequestServices.serviceId })
                .from(jobRequestServices)
                .where(eq(jobRequestServices.id, jobId))
                .limit(1)
                .then(rows => rows[0]),
            db.select({ id: blueBookEntries.id })
                .from(blueBookEntries)
                .where(eq(blueBookEntries.id, jobId))
                .limit(1)
                .then(rows => rows[0])
        ]);

        if (!jrs && !bbe) {
            return json({ ok: false, error: 'Job not found in either system' }, 404);
        }

        // Check if an existing assignment for this job is in DRAFT status
        const [existingDraft] = await db.select()
            .from(assignments)
            .where(
                and(
                    jrs ? eq(assignments.jobRequestServiceId, jobId) : eq(assignments.blueBookEntryId, jobId),
                    eq(assignments.status, 'DRAFT') // Only overwrite DRAFTS, not SENT/DISPATCHED
                )
            )
            .limit(1);

        let assignmentId = '';

        if (existingDraft) {
            // Update existing DRAFT assignment directly to DISPATCHED
            // We do this to reuse the ID and prevent ghost duplicates
            await db.update(assignments)
                .set({
                    dispatchBatchId: batchId,
                    crewId: crew.id,
                    status: 'DISPATCHED' // Directly set to dispatched
                })
                .where(eq(assignments.id, existingDraft.id));
            assignmentId = existingDraft.id;
        } else {
            // Create new assignment as DISPATCHED
            const [newAssignment] = await db.insert(assignments).values({
                jobRequestServiceId: jrs ? jobId : null,
                blueBookEntryId: bbe ? jobId : null,
                dispatchBatchId: batchId,
                crewId: crew.id,
                status: 'DISPATCHED', // Directly set to dispatched
            }).returning();
            assignmentId = newAssignment.id;
        }

        // Update status and foreman name in the source table
        if (jrs) {
            // Update Job Request Service
            await db
                .update(jobRequestServices)
                .set({
                    assignedForemanName: foremanName,
                })
                .where(eq(jobRequestServices.id, jobId));

            // AUTO-CREATE BLUE BOOK ENTRY if not exists
            const existingBBE = await db.query.blueBookEntries.findFirst({
                where: eq(blueBookEntries.assignmentId, assignmentId)
            });

            if (!existingBBE && jrs.jobRequestId) {
                const [jobReq] = await db.select({
                    id: jobRequests.id,
                    builderId: jobRequests.builderId,
                    communityId: jobRequests.communityId,
                    lot: jobRequests.lot,
                    modelPlanId: jobRequests.modelPlanId,
                    poNumber: jobRequests.poNumber,
                    dueDate: jobRequests.dueDate,
                })
                    .from(jobRequests)
                    .where(eq(jobRequests.id, jrs.jobRequestId))
                    .limit(1);

                if (jobReq) {
                    await db.insert(blueBookEntries).values({
                        builderId: jobReq.builderId,
                        communityId: jobReq.communityId,
                        lot: jobReq.lot,
                        modelPlanId: jobReq.modelPlanId,
                        serviceId: jrs.serviceId,
                        poNumber: jobReq.poNumber,
                        startDate: jobReq.dueDate,
                        status: 'PENDING',
                        assignmentId: assignmentId,
                        assignedForemanName: foremanName,
                        source: 'dispatch',
                    });
                }
            }
        } else if (bbe) {
            await db
                .update(blueBookEntries)
                .set({
                    assignedForemanName: foremanName,
                    status: 'PENDING',
                    assignmentId: assignmentId,
                    updatedAt: new Date(),
                })
                .where(eq(blueBookEntries.id, jobId));
        }

        // CRITICAL FIX: Update assignment status explicitly
        // Assignment status already updated above to DISPATCHED

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

        // Publish realtime event
        // await publishOrgEvent(membership.orgId, 'dispatch.updated', { batchId });

        // Critical Fix: Publish to specific 'schedule' channel
        const rest = await import('@/lib/ably').then(m => m.getAblyRest());
        if (rest) {
            await rest.channels.get('schedule').publish('update', {
                id: jobId,
                status: 'DISPATCHED'
            });
        }
        // Simplified response to prevent 500 errors from complex joins
        return json({
            ok: true,
            message: `Job dispatched to ${foremanName} / ${crewName}`,
            crewId: crew.id,
            batchId,
            assignmentId: assignmentId,
        });
    } catch (error) {
        console.error('Error dispatching job:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to dispatch job' }, 500);
    }
}
