import { getDb } from '@/lib/db/get-db';
import { fieldTickets, assignments, blueBookEntries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@/lib/utils/json';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const resolvedParams = await params;
    const { assignmentId } = resolvedParams;
    const db = await getDb();
    const data = await req.json();
    const { status, notes, windows, tubs, foremanSig, customerSig } = data;

    const existingTicket = await db.query.fieldTickets.findFirst({
      where: eq(fieldTickets.assignmentId, assignmentId),
    });

    const ticketRows = existingTicket
      ? await db
          .update(fieldTickets)
          .set({
            status: 'SUBMITTED',
            notes,
            items: { windows, tubs },
            foremanSig,
            customerSig,
            submittedAt: new Date(),
          })
          .where(eq(fieldTickets.id, existingTicket.id))
          .returning()
      : await db
          .insert(fieldTickets)
          .values({
            assignmentId: assignmentId,
            status: 'SUBMITTED',
            notes,
            items: { windows, tubs },
            foremanSig,
            customerSig,
            submittedAt: new Date(),
          })
          .returning();

    const [ticket] = ticketRows;

    await db
      .update(assignments)
      .set({ status })
      .where(eq(assignments.id, assignmentId));

    const assignmentDetails = await db.query.assignments.findFirst({
      where: eq(assignments.id, assignmentId),
      with: {
        jobRequestService: {
          with: {
            jobRequest: true,
            service: true,
          },
        },
      },
    });

    if (assignmentDetails) {
      await db.insert(blueBookEntries).values({
        builderId: assignmentDetails.jobRequestService.jobRequest.builderId,
        communityId: assignmentDetails.jobRequestService.jobRequest.communityId,
        lot: assignmentDetails.jobRequestService.jobRequest.lot,
        modelPlanId: assignmentDetails.jobRequestService.jobRequest.modelPlanId,
        serviceId: assignmentDetails.jobRequestService.serviceId,
        poNumber: assignmentDetails.jobRequestService.jobRequest.poNumber,
        status: 'COMPLETE',
        assignmentId: assignmentId,
        ticketId: ticket.id,
      });
    }

    return json(ticket);
  } catch (error) {
    console.error('Error submitting ticket:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to submit ticket' }, 500);
  }
}
