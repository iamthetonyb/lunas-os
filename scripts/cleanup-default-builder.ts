/**
 * Cleanup script: Remove 'Default Builder' and 'Sunset Hills' entries
 * Reassigns any jobs to 'Pulte' before deletion
 */

import { getDb } from '@/lib/db/get-db';
import { builders, communities, jobRequests, blueBookEntries } from '@/db/schema';
import { eq, ilike } from 'drizzle-orm';

async function main() {
    console.log('[cleanup] Starting Default Builder cleanup...');
    const db = await getDb();

    // Find Default Builder
    const defaultBuilder = await db.query.builders.findFirst({
        where: ilike(builders.name, 'Default Builder'),
    });

    // Find Pulte (target for reassignment)
    let pulteBuilder = await db.query.builders.findFirst({
        where: ilike(builders.name, 'Pulte%'),
    });

    if (!pulteBuilder) {
        console.log('[cleanup] Pulte builder not found. Creating one...');
        const [created] = await db.insert(builders).values({
            name: 'Pulte',
        }).returning();
        pulteBuilder = created;
        console.log('[cleanup] ✅ Created Pulte builder:', pulteBuilder.id);
    }

    if (!defaultBuilder) {
        console.log('[cleanup] Default Builder not found. Nothing to clean.');
        return;
    }

    console.log('[cleanup] Found Default Builder:', defaultBuilder.id);
    console.log('[cleanup] Will reassign jobs to Pulte:', pulteBuilder.id);

    // Find Sunset Hills community linked to Default Builder
    const sunsetHills = await db.query.communities.findFirst({
        where: ilike(communities.name, 'Sunset Hills'),
    });

    // Reassign job_requests from Default Builder to Pulte
    const updatedJobRequests = await db
        .update(jobRequests)
        .set({ builderId: pulteBuilder.id })
        .where(eq(jobRequests.builderId, defaultBuilder.id))
        .returning({ id: jobRequests.id });

    console.log(`[cleanup] Reassigned ${updatedJobRequests.length} job_requests to Pulte.`);

    // Reassign blue_book_entries from Default Builder to Pulte
    const updatedBlueBook = await db
        .update(blueBookEntries)
        .set({ builderId: pulteBuilder.id })
        .where(eq(blueBookEntries.builderId, defaultBuilder.id))
        .returning({ id: blueBookEntries.id });

    console.log(`[cleanup] Reassigned ${updatedBlueBook.length} blue_book_entries to Pulte.`);

    // Delete Sunset Hills community if found
    if (sunsetHills) {
        // Reassign communities first
        await db.update(jobRequests).set({ communityId: null }).where(eq(jobRequests.communityId, sunsetHills.id));
        await db.update(blueBookEntries).set({ communityId: null }).where(eq(blueBookEntries.communityId, sunsetHills.id));

        await db.delete(communities).where(eq(communities.id, sunsetHills.id));
        console.log('[cleanup] ✅ Deleted Sunset Hills community');
    }

    // Delete Default Builder
    await db.delete(builders).where(eq(builders.id, defaultBuilder.id));
    console.log('[cleanup] ✅ Deleted Default Builder');

    console.log('[cleanup] Cleanup complete!');
}

main().catch((err) => {
    console.error('[cleanup] Error:', err);
    process.exit(1);
});
