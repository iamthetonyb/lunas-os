import { getDb } from '@/lib/db/get-db';
import {
  communities,
  services,
  jobRequests,
  jobRequestServices,
  assignments,
  fieldTickets,
} from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { json } from '@/lib/utils/json';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function POST(req: Request) {
  try {
    const db = await getDb();
    const data = await req.json();
    const { builderId, rows } = data;

    const tubsWindowsService = await db.query.services.findFirst({
      where: eq(services.code, 'TUBS_WINDOWS'),
    });

    if (!tubsWindowsService) {
      return json({ ok: false, error: 'TUBS_WINDOWS service not found' }, 400);
    }

    for (const row of rows) {
      const { Jobsite, Lot, Windows, Tubs, Total, Date: dateStr } = row;

      let community = await db.query.communities.findFirst({
        where: and(eq(communities.name, Jobsite), eq(communities.builderId, builderId)),
      });

      if (!community) {
        const [createdCommunity] = await db
          .insert(communities)
          .values({
            name: Jobsite,
            builderId,
          })
          .returning();
        community = createdCommunity;
      }

      const [jobRequest] = await db
        .insert(jobRequests)
        .values({
          builderId,
          communityId: community.id,
          lot: Lot,
          dueDate: dateStr ? new Date(dateStr).toISOString().split('T')[0] : null,
        })
        .returning();

      const [jobRequestServiceRow] = await db
        .insert(jobRequestServices)
        .values({
          jobRequestId: jobRequest.id,
          serviceId: tubsWindowsService.id,
          requestedData: { windows: Windows, tubs: Tubs, total: Total },
        })
        .returning();

      const sameDayAssignment = await db.query.assignments.findFirst({
        where: eq(assignments.jobRequestServiceId, jobRequestServiceRow.id),
      });

      if (sameDayAssignment) {
        await db.insert(fieldTickets).values({
          assignmentId: sameDayAssignment.id,
          items: { windows: Windows, tubs: Tubs, total: Total },
        });
      }
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Error importing tubs/windows data:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Import failed' }, 500);
  }
}
