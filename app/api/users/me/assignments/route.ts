import { getDb } from '@/lib/db/get-db';
import { assignments, dispatchBatches, jobRequestServices, blueBookEntries, jobRequests, communities, builders } from '@/db/schema';
import { eq, and, gte, or } from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm';
import { safe, ok, err } from '@/lib/api/http';
import { auth } from '@/auth';

export const runtime = 'nodejs';

export const GET = safe(async (req: Request) => {
    const session = await auth();
    if (!session?.user?.id) {
        return err('Unauthorized', 401);
    }

    const db = await getDb();
    const userName = session.user.name;

    if (!userName) {
        return ok([]);
    }

    const today = new Date().toISOString().split('T')[0];

    // Aliases for communities and builders to join twice
    const jrsCommunities = aliasedTable(communities, 'jrs_communities');
    const jrsBuilders = aliasedTable(builders, 'jrs_builders');
    const bbeCommunities = aliasedTable(communities, 'bbe_communities');
    const bbeBuilders = aliasedTable(builders, 'bbe_builders');

    const myAssignments = await db
        .select({
            id: assignments.id,
            status: assignments.status,
            serviceDate: dispatchBatches.serviceDate,
            crewName: dispatchBatches.crewName,
            foremanName: dispatchBatches.foremanName,

            // JRS info
            jrsId: jobRequestServices.id,
            lot: jobRequests.lot,
            communityName: jrsCommunities.name,
            builderName: jrsBuilders.name,

            // BBE info
            bbeId: blueBookEntries.id,
            bbeLot: blueBookEntries.lot,
            bbeCommunityName: bbeCommunities.name,
            bbeBuilderName: bbeBuilders.name,
            bbeAccountCategoryName: blueBookEntries.accountCategoryName,
        })
        .from(assignments)
        .innerJoin(dispatchBatches, eq(assignments.dispatchBatchId, dispatchBatches.id))
        // JRS joins
        .leftJoin(jobRequestServices, eq(assignments.jobRequestServiceId, jobRequestServices.id))
        .leftJoin(jobRequests, eq(jobRequestServices.jobRequestId, jobRequests.id))
        .leftJoin(jrsCommunities, eq(jobRequests.communityId, jrsCommunities.id))
        .leftJoin(jrsBuilders, eq(jobRequests.builderId, jrsBuilders.id))
        // BBE joins
        .leftJoin(blueBookEntries, eq(assignments.blueBookEntryId, blueBookEntries.id))
        .leftJoin(bbeCommunities, eq(blueBookEntries.communityId, bbeCommunities.id))
        .leftJoin(bbeBuilders, eq(blueBookEntries.builderId, bbeBuilders.id))
        .where(
            and(
                gte(dispatchBatches.serviceDate, today),
                or(
                    eq(dispatchBatches.foremanName, userName),
                    eq(dispatchBatches.crewName, userName)
                )
            )
        )
        .orderBy(dispatchBatches.serviceDate);

    const formatted = myAssignments.map(a => ({
        id: a.id,
        date: a.serviceDate,
        foreman: a.foremanName,
        crew: a.crewName,
        community: a.communityName || a.bbeCommunityName || '—',
        builder: a.builderName || a.bbeBuilderName || '—',
        lot: a.lot || a.bbeLot || '—',
        service: a.bbeAccountCategoryName || 'Service',
        status: a.status
    }));

    return ok(formatted);
});
