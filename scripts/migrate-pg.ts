import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../db/schema';

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: 'db/migrations' });
  await client.end();
  console.log('✅ Programmatic migrations applied');
}
main().catch(async (e) => {
  console.error('❌ migrate.ts failed', e);
  process.exit(1);
});
