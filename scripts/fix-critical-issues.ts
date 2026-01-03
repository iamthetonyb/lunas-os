/**
 * Fix critical issues:
 * 1. Add is_extra_work column if missing
 * 2. Delete Default Builder and Sunset Hills
 * 3. Reassign any orphaned jobs to Pulte
 */

import { getDb } from '@/lib/db/get-db';
import { builders, communities, jobRequests, blueBookEntries } from '@/db/schema';
import { eq, ilike, sql } from 'drizzle-orm';

async function main() {
    console.log('[migration] Starting critical fixes...');
    const db = await getDb();

    // 1. Add is_extra_work column if it doesn't exist
    console.log('[migration] Step 1: Checking is_extra_work column...');
    try {
        await db.execute(sql`
      ALTER TABLE job_requests 
      ADD COLUMN IF NOT EXISTS is_extra_work BOOLEAN DEFAULT false
    `);
        console.log('[migration] ✅ is_extra_work column ensured');
    } catch (err) {
        console.log('[migration] is_extra_work column may already exist:', (err as Error).message);
    }

    // 2. Find or create Pulte builder
    console.log('[migration] Step 2: Finding Pulte builder...');
    let pulteBuilder = await db.query.builders.findFirst({
        where: ilike(builders.name, 'Pulte%'),
    });

    if (!pulteBuilder) {
        console.log('[migration] Creating Pulte builder...');
        const [created] = await db.insert(builders).values({
            name: 'Pulte',
        }).returning();
        pulteBuilder = created;
        console.log('[migration] ✅ Created Pulte builder:', pulteBuilder.id);
    } else {
        console.log('[migration] ✅ Found Pulte builder:', pulteBuilder.id);
    }

    // 3. Find Default Builder
    const defaultBuilder = await db.query.builders.findFirst({
        where: ilike(builders.name, 'Default Builder'),
    });

    if (defaultBuilder) {
        console.log('[migration] Step 3: Reassigning from Default Builder to Pulte...');

        // Reassign job_requests
        const updatedJobs = await db
            .update(jobRequests)
            .set({ builderId: pulteBuilder.id })
            .where(eq(jobRequests.builderId, defaultBuilder.id))
            .returning({ id: jobRequests.id });
        console.log(`[migration] Reassigned ${updatedJobs.length} job_requests`);

        // Reassign blue_book_entries
        const updatedBlueBook = await db
            .update(blueBookEntries)
            .set({ builderId: pulteBuilder.id })
            .where(eq(blueBookEntries.builderId, defaultBuilder.id))
            .returning({ id: blueBookEntries.id });
        console.log(`[migration] Reassigned ${updatedBlueBook.length} blue_book_entries`);

        // Delete Default Builder
        await db.delete(builders).where(eq(builders.id, defaultBuilder.id));
        console.log('[migration] ✅ Deleted Default Builder');
    } else {
        console.log('[migration] Default Builder not found, skipping...');
    }

    // 4. Delete Sunset Hills community
    console.log('[migration] Step 4: Removing Sunset Hills...');
    const sunsetHills = await db.query.communities.findFirst({
        where: ilike(communities.name, 'Sunset Hills'),
    });

    if (sunsetHills) {
        // Clear references first
        await db.update(jobRequests).set({ communityId: null }).where(eq(jobRequests.communityId, sunsetHills.id));
        await db.update(blueBookEntries).set({ communityId: null }).where(eq(blueBookEntries.communityId, sunsetHills.id));

        await db.delete(communities).where(eq(communities.id, sunsetHills.id));
        console.log('[migration] ✅ Deleted Sunset Hills community');
    } else {
        console.log('[migration] Sunset Hills not found, skipping...');
    }

    console.log('[migration] ✅ All critical fixes complete!');
}

main().catch((err) => {
    console.error('[migration] Error:', err);
    process.exit(1);
});
