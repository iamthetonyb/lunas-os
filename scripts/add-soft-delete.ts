/**
 * SOFT DELETE Migration Script
 * Adds 'active' boolean column to key tables for soft delete functionality
 * 
 * Run with: DATABASE_URL="your_connection_string" pnpm tsx scripts/add-soft-delete.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('[migration] ERROR: DATABASE_URL environment variable is required');
        process.exit(1);
    }

    console.log('[migration] Connecting to database...');
    const client = postgres(databaseUrl);
    const db = drizzle(client);

    try {
        // Tables that need soft delete support
        const tables = [
            'builders',
            'communities',
            'services',
            'model_plans',
            'rates',
        ];

        for (const table of tables) {
            console.log(`[migration] Adding 'active' column to ${table}...`);
            try {
                await db.execute(sql.raw(`
          ALTER TABLE ${table}
          ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true
        `));
                console.log(`[migration] ✅ ${table}.active column ensured`);
            } catch (err) {
                console.log(`[migration] Column may already exist for ${table}:`, (err as Error).message);
            }
        }

        console.log('[migration] ✅ Soft delete migration complete!');
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
