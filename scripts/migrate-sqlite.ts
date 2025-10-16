import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema';

async function main() {
  const sqlitePath = process.env.SQLITE_PATH ?? 'dev.db';
  const client = new Database(sqlitePath);
  const db = drizzle(client, { schema });
  
  migrate(db, { migrationsFolder: 'db/migrations-sqlite' });
  
  client.close();
  console.log('✅ SQLite migrations applied');
}

main().catch(async (e) => {
  console.error('❌ migrate-sqlite.ts failed', e);
  process.exit(1);
});
