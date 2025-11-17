require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { drizzle } = require('drizzle-orm/postgres-js');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const postgres = require('postgres');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  console.log('[migrate] DATABASE_URL =', url);

  const client = postgres(url, {
    ssl: false, // Never use SSL for localhost
  });
  const db = drizzle(client);

  await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await client`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

  await migrate(db, { migrationsFolder: 'drizzle/pg' });
  await client.end({ timeout: 5 });
  console.log('✓ PG migrations applied');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
