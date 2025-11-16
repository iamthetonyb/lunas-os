import 'server-only';

import * as schema from './schema';

type Provider = 'sqlite' | 'postgres';

const provider: Provider =
  (process.env.DATABASE_PROVIDER as Provider | undefined) ??
  (process.env.DATABASE_URL ? 'postgres' : 'sqlite');

let dbPromise: Promise<any> | null = null;

async function createDb() {
  if (provider === 'sqlite') {
    const Database = (await import('better-sqlite3')).default;
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const sqlitePath = process.env.SQLITE_PATH || '.data/lunas.db';
    const sqlite = new Database(sqlitePath);
    return drizzle(sqlite, { schema });
  }

  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is missing for postgres provider');
  }
  const client = postgres(url, {
    ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined,
    max: 10,
  });
  return drizzle(client, { schema });
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = createDb();
  }
  return dbPromise;
}

export type DB = ReturnType<typeof getDb> extends Promise<infer T> ? T : never;

export { schema, provider };
