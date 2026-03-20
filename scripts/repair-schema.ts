
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL environment variable is required');
        process.exit(1);
    }

    console.log('Connecting to database...');
    const client = postgres(databaseUrl);
    const db = drizzle(client);

    try {
        // 1. Add active column to services
        console.log("Checking 'services' table...");
        await db.execute(sql`
      ALTER TABLE services 
      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true
    `);
        console.log("✅ 'services.active' column ensured");

        // 2. Add active column to model_plans
        console.log("Checking 'model_plans' table...");
        await db.execute(sql`
      ALTER TABLE model_plans 
      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true
    `);
        console.log("✅ 'model_plans.active' column ensured");

        // 3. Add active column to contract_rates
        console.log("Checking 'contract_rates' table...");
        await db.execute(sql`
      ALTER TABLE contract_rates 
      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true
    `);
        console.log("✅ 'contract_rates.active' column ensured");

        console.log('✅ Schema repair complete!');
    } catch (error) {
        console.error('Error repairing schema:', error);
        throw error;
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
