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

    // Type guard: ensure nested properties exist before accessing
    // Using type assertion to work around Drizzle ORM type inference issue
    if (assignmentDetails && (assignmentDetails as any).jobRequestService?.jobRequest) {
      const jobRequest = (assignmentDetails as any).jobRequestService.jobRequest;
      const serviceId = (assignmentDetails as any).jobRequestService.serviceId;
      
      await db.insert(blueBookEntries).values({
        builderId: jobRequest.builderId,
        communityId: jobRequest.communityId,
        lot: jobRequest.lot,
        modelPlanId: jobRequest.modelPlanId,
        serviceId: serviceId,
        poNumber: jobRequest.poNumber,
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
