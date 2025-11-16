import 'server-only';

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';

type AnyDb = PostgresJsDatabase<typeof schema> | BetterSQLite3Database<typeof schema>;

let cached: AnyDb | null = null;

export async function getDb(): Promise<AnyDb> {
  if (cached) return cached;

  const provider = (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase();

  if (provider === 'sqlite') {
    const [{ drizzle }, { default: Database }] = await Promise.all([
      import('drizzle-orm/better-sqlite3'),
      import('better-sqlite3'),
    ]);
    const path = process.env.SQLITE_PATH || '.data/lunas.db';
    const sqlite = new Database(path);
    cached = drizzle(sqlite, { schema });
    return cached;
  }

  const [{ drizzle }, { default: postgres }] = await Promise.all([
    import('drizzle-orm/postgres-js'),
    import('postgres'),
  ]);
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required when DATABASE_PROVIDER=postgres');
  }
  const host = new URL(url).hostname;
  const pgOpts =
    /^(localhost|127\.0\.0\.1)$/i.test(host) ? {} : { ssl: 'require' as const };
  const client = postgres(url, pgOpts);
  cached = drizzle(client, { schema });
  return cached;
}
