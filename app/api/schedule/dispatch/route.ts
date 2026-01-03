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
        const [jrs, bbe] = await Promise.all([
            db.query.jobRequestServices.findFirst({ where: eq(jobRequestServices.id, jobId) }),
            db.query.blueBookEntries.findFirst({ where: eq(blueBookEntries.id, jobId) })
        ]);

        if (!jrs && !bbe) {
            return json({ ok: false, error: 'Job not found in either system' }, 404);
        }

        const [assignment] = await db.insert(assignments).values({
            jobRequestServiceId: jrs ? jobId : null,
            blueBookEntryId: bbe ? jobId : null,
            dispatchBatchId: batchId,
            crewId: crew.id,
            status: 'SENT',
        }).returning();

        // Update status and foreman name in the source table
        if (jrs) {
            // Update Job Request Service
            await db
                .update(jobRequestServices)
                .set({
                    assignedForemanName: foremanName,
                    // updatedAt: new Date(),
                })
                .where(eq(jobRequestServices.id, jobId));

            // AUTO-CREATE BLUE BOOK ENTRY if not exists
            // Verify if one already exists for this service
            const existingBBE = await db.query.blueBookEntries.findFirst({
                where: eq(blueBookEntries.assignmentId, assignment.id)
            });

            if (!existingBBE) {
                // Fetch full JRS details (we only have the ID from check above)
                const fullJrs = await db.query.jobRequestServices.findFirst({
                    where: eq(jobRequestServices.id, jobId),
                });

                if (fullJrs && fullJrs.jobRequestId) {
                    const jobReq = await db.query.jobRequests.findFirst({
                        where: eq(jobRequests.id, fullJrs.jobRequestId)
                    });

                    if (jobReq) {
                        await db.insert(blueBookEntries).values({
                            builderId: jobReq.builderId,
                            communityId: jobReq.communityId,
                            lot: jobReq.lot,
                            modelPlanId: jobReq.modelPlanId,
                            serviceId: fullJrs.serviceId,
                            poNumber: jobReq.poNumber,
                            status: 'PENDING',
                            assignmentId: assignment.id,
                            assignedForemanName: foremanName,
                            source: 'dispatch',
                        });
                    }
                }
            }

        } else if (bbe) {
            await db
                .update(blueBookEntries)
                .set({
                    assignedForemanName: foremanName,
                    status: 'PENDING',
                    assignmentId: assignment.id,
                    updatedAt: new Date(),
                })
                .where(eq(blueBookEntries.id, jobId));
        }

        // CRITICAL FIX: Update assignment status explicitly
        await db.update(assignments)
            .set({ status: 'DISPATCHED' })
            .where(eq(assignments.id, assignment.id));

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

        return json({
            ok: true,
            message: `Job dispatched to ${foremanName} / ${crewName}`,
            crewId: crew.id,
            batchId,
        });
    } catch (error) {
        console.error('Error dispatching job:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to dispatch job' }, 500);
    }
}
