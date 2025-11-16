import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

export function getPgDrizzle() {
  const url = process.env.DATABASE_URL!;
  console.log('[db-client] DATABASE_URL =', url);
  const host = new URL(url).hostname;
  const pgOpts = /^(localhost|127\.0\.0\.1)$/i.test(host)
    ? {}
    : { ssl: 'require' };
  const client = postgres(url, pgOpts as any);
  const db = drizzle(client, { schema });
  return { db, client, schema };
}
