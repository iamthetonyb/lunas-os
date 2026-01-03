import { sql } from 'drizzle-orm';
import { getPgDrizzle } from './db-client';
import 'dotenv/config';

async function main() {
    console.log("Starting migration...");

    // Use getPgDrizzle for raw access if getDb doesn't support sql correctly or for script context
    const { db, client } = getPgDrizzle();

    try {
        // 1. Add columns to job_requests
        await db.execute(sql`ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS amount DECIMAL;`);
        await db.execute(sql`ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS status TEXT;`);
        console.log("Added columns to job_requests");

        // 2. Add DISPATCHED to assignment_status enum
        // Postgres enums can be tricky. safely add value
        try {
            await db.execute(sql`ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'DISPATCHED';`);
            console.log("Added DISPATCHED to assignment_status enum");
        } catch (e: any) {
            console.log("Enum update info (might already exist):", e.message);
        }
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await client.end();
    }
}

main();
