import 'dotenv/config';
import * as schema from './schema';

// Postgres (postgres-js)
import postgres from 'postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';

// SQLite (better-sqlite3)
import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';

const url = process.env.DATABASE_URL;
const useSqlite = !url || !url.startsWith('postgres');

// Create a singleton connection
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
  sqliteClient: Database.Database | undefined;
};

let client: any;
let db: any;

// SQLite for dev (no Docker needed)
if (useSqlite) {
  const sqlitePath = process.env.SQLITE_PATH ?? 'dev.db';
  const sqliteClient = globalForDb.sqliteClient ?? new Database(sqlitePath);
  
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.sqliteClient = sqliteClient;
  }
  
  client = sqliteClient;
  db = drizzleSqlite(sqliteClient, { schema });
} else {
  // Postgres for production
  const pgClient = globalForDb.pgClient ?? postgres(url, { 
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.pgClient = pgClient;
  }
  
  client = pgClient;
  db = drizzlePg(pgClient, { schema });
}

export { db, client };
