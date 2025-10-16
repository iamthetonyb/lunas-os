import { db } from '@/db';
import { fieldTickets, assignments, blueBookEntries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: { assignmentId: string } }) {
  const data = await req.json();
  const { status, notes, windows, tubs, foremanSig, customerSig } = data;

  const existingTicket = await db.query.fieldTickets.findFirst({
    where: eq(fieldTickets.assignmentId, params.assignmentId),
  });

  let ticket;
  if (existingTicket) {
    ticket = await db.update(fieldTickets).set({
      status: 'SUBMITTED',
      notes,
      items: { windows, tubs },
      foremanSig,
      customerSig,
      submittedAt: new Date(),
    }).where(eq(fieldTickets.id, existingTicket.id)).returning();
  } else {
    ticket = await db.insert(fieldTickets).values({
      assignmentId: params.assignmentId,
      status: 'SUBMITTED',
      notes,
      items: { windows, tubs },
      foremanSig,
      customerSig,
      submittedAt: new Date(),
    }).returning();
  }

  await db.update(assignments).set({
    status,
  }).where(eq(assignments.id, params.assignmentId));

  const assignmentDetails = await db.query.assignments.findFirst({
    where: eq(assignments.id, params.assignmentId),
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
      assignmentId: params.assignmentId,
      ticketId: ticket[0].id,
      // amount will be calculated later
    });
  }

  return NextResponse.json(ticket[0]);
}
