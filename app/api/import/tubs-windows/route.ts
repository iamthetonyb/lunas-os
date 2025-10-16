import { db } from '@/db';
import { communities, services, jobRequests, jobRequestServices, assignments, fieldTickets } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const data = await req.json();
  const { builderId, rows } = data;

  const tubsWindowsService = await db.query.services.findFirst({
    where: eq(services.code, 'TUBS_WINDOWS'),
  });

  if (!tubsWindowsService) {
    return NextResponse.json({ error: 'TUBS_WINDOWS service not found' }, { status: 400 });
  }

  for (const row of rows) {
    const { Jobsite, Lot, Windows, Tubs, Total, Date: dateStr } = row;

    let community = await db.query.communities.findFirst({
      where: and(
        eq(communities.name, Jobsite),
        eq(communities.builderId, builderId)
      ),
    });

    if (!community) {
      const newCommunity = await db.insert(communities).values({
        name: Jobsite,
        builderId,
      }).returning();
      community = newCommunity[0];
    }

    const newJobRequest = await db.insert(jobRequests).values({
      builderId,
      communityId: community.id,
      lot: Lot,
      dueDate: new Date(dateStr),
    }).returning();

    const newJobRequestService = await db.insert(jobRequestServices).values({
      jobRequestId: newJobRequest[0].id,
      serviceId: tubsWindowsService.id,
      requestedData: { windows: Windows, tubs: Tubs, total: Total },
    }).returning();

    const sameDayAssignment = await db.query.assignments.findFirst({
      where: eq(assignments.jobRequestServiceId, newJobRequestService[0].id),
    });

    if (sameDayAssignment) {
      await db.insert(fieldTickets).values({
        assignmentId: sameDayAssignment.id,
        items: { windows: Windows, tubs: Tubs, total: Total },
      });
    }
  }

  return NextResponse.json({ success: true });
}
