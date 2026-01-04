import { sql } from 'drizzle-orm';
import { getPgDrizzle } from './db-client';
import 'dotenv/config';

async function main() {
    console.log("Starting migration: Add amount and status to job_requests...");

    const { db, client } = getPgDrizzle();

    try {
        // 1. Add columns to job_requests
        await db.execute(sql`ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS amount DECIMAL(12, 2);`);
        await db.execute(sql`ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';`);
        console.log("SUCCESS: Added columns to job_requests");

        // 2. Ensure value existence in assignment_status if needed
        try {
            await db.execute(sql`ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'DISPATCHED';`);
            console.log("SUCCESS: Added DISPATCHED to assignment_status enum");
        } catch (e) {
            // Ignore if already exists or not supported
        }

    } catch (error) {
        console.error("Migration FAILED:", error);
    } finally {
        await client.end();
    }
}

main();
