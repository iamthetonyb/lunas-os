// lib/db/get-db.ts - Postgres-only database client
import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

// Postgres-only type - no SQLite union to avoid TypeScript compilation errors
type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for Postgres');
  }

  const host = new URL(url).hostname;
  const pgOpts =
    /^(localhost|127\.0\.0\.1)$/i.test(host) ? {} : { ssl: 'require' as const };

  const client = postgres(url, pgOpts);
  cached = drizzle(client, { schema });
  return cached;
}
