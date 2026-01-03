/**
 * STANDALONE Migration Script
 * No @/lib imports - uses direct postgres connection
 * 
 * Run with: DATABASE_URL="your_connection_string" pnpm tsx scripts/fix-critical-issues.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('[migration] ERROR: DATABASE_URL environment variable is required');
        console.error('Usage: DATABASE_URL="postgres://user:pass@host:port/db" pnpm tsx scripts/fix-critical-issues.ts');
        process.exit(1);
    }

    console.log('[migration] Connecting to database...');
    const client = postgres(databaseUrl);
    const db = drizzle(client);

    try {
        // 1. Add is_extra_work column to job_requests if missing
        console.log('[migration] Step 1: Adding is_extra_work column to job_requests...');
        await db.execute(sql`
      ALTER TABLE job_requests 
      ADD COLUMN IF NOT EXISTS is_extra_work BOOLEAN DEFAULT false
    `);
        console.log('[migration] ✅ is_extra_work column ensured');

        // 2. Backfill scheduled_start from due_date for assignments that have NULL scheduled_start
        console.log('[migration] Step 2: Backfilling scheduled_start from job_request due_date...');
        const backfillResult = await db.execute(sql`
      UPDATE assignments a
      SET scheduled_start = jr.due_date::timestamp
      FROM job_request_services jrs
      JOIN job_requests jr ON jrs.job_request_id = jr.id
      WHERE a.job_request_service_id = jrs.id
      AND a.scheduled_start IS NULL
      AND jr.due_date IS NOT NULL
    `);
        console.log('[migration] ✅ Backfilled scheduled_start for assignments');

        // 3. Find or create Pulte builder
        console.log('[migration] Step 3: Finding/creating Pulte builder...');
        let pulteResult = await db.execute(sql`
      SELECT id FROM builders WHERE LOWER(name) LIKE 'pulte%' LIMIT 1
    `);

        let pulteId: string;
        if (pulteResult.length === 0) {
            const newPulte = await db.execute(sql`
        INSERT INTO builders (id, name) 
        VALUES (gen_random_uuid(), 'Pulte')
        RETURNING id
      `);
            pulteId = (newPulte[0] as { id: string }).id;
            console.log('[migration] ✅ Created Pulte builder:', pulteId);
        } else {
            pulteId = (pulteResult[0] as { id: string }).id;
            console.log('[migration] ✅ Found existing Pulte builder:', pulteId);
        }

        // 4. Find Default Builder
        console.log('[migration] Step 4: Removing Default Builder...');
        const defaultBuilderResult = await db.execute(sql`
      SELECT id FROM builders WHERE LOWER(name) = 'default builder' LIMIT 1
    `);

        if (defaultBuilderResult.length > 0) {
            const defaultBuilderId = (defaultBuilderResult[0] as { id: string }).id;

            // Reassign job_requests
            await db.execute(sql`
        UPDATE job_requests SET builder_id = ${pulteId} WHERE builder_id = ${defaultBuilderId}
      `);
            console.log('[migration] Reassigned job_requests from Default Builder to Pulte');

            // Reassign blue_book_entries
            await db.execute(sql`
        UPDATE blue_book_entries SET builder_id = ${pulteId} WHERE builder_id = ${defaultBuilderId}
      `);
            console.log('[migration] Reassigned blue_book_entries from Default Builder to Pulte');

            // Delete Default Builder
            await db.execute(sql`DELETE FROM builders WHERE id = ${defaultBuilderId}`);
            console.log('[migration] ✅ Deleted Default Builder');
        } else {
            console.log('[migration] Default Builder not found, skipping...');
        }

        // 5. Delete Sunset Hills community
        console.log('[migration] Step 5: Removing Sunset Hills community...');
        const sunsetHillsResult = await db.execute(sql`
      SELECT id FROM communities WHERE LOWER(name) = 'sunset hills' LIMIT 1
    `);

        if (sunsetHillsResult.length > 0) {
            const sunsetHillsId = (sunsetHillsResult[0] as { id: string }).id;

            // Clear references
            await db.execute(sql`UPDATE job_requests SET community_id = NULL WHERE community_id = ${sunsetHillsId}`);
            await db.execute(sql`UPDATE blue_book_entries SET community_id = NULL WHERE community_id = ${sunsetHillsId}`);

            // Delete community
            await db.execute(sql`DELETE FROM communities WHERE id = ${sunsetHillsId}`);
            console.log('[migration] ✅ Deleted Sunset Hills community');
        } else {
            console.log('[migration] Sunset Hills not found, skipping...');
        }

        console.log('[migration] ✅ All migrations complete!');
    } catch (error) {
        console.error('[migration] ERROR:', error);
        throw error;
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('[migration] Fatal error:', err);
    process.exit(1);
});
