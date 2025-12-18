import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { assignments, crews, dispatchBatches, blueBookEntries, jobRequestServices } from '@/db/schema';
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

        // Check if a batch already exists for this crew/foreman today
        const existingBatch = await db.query.dispatchBatches.findFirst({
            where: and(
                eq(dispatchBatches.serviceDate, today),
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
                    serviceDate: today,
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
            await db
                .update(jobRequestServices)
                .set({
                    assignedForemanName: foremanName,
                    // updatedAt: new Date(), // Column does not exist
                })
                .where(eq(jobRequestServices.id, jobId));
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
        await publishOrgEvent(membership.orgId, 'dispatch.updated', { batchId });

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
