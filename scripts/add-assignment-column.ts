import { getDb } from '../lib/db/get-db';
import { sql } from 'drizzle-orm';

async function main() {
    const db = await getDb();
    console.log('Adding blue_book_entry_id column to assignments table...');
    try {
        await db.execute(sql`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS blue_book_entry_id UUID REFERENCES blue_book_entries(id);`);
        console.log('Column added successfully.');
    } catch (err) {
        console.error('Failed to add column:', err);
    }
}

main();
