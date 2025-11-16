import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

async function main() {
  const dbPath = process.env.SQLITE_PATH || '.data/lunas.db';
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  await migrate(db, { migrationsFolder: 'drizzle/sqlite' });
  sqlite.close();
  console.log('✓ SQLite migrations applied:', dbPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
