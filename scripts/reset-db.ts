import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const adminUrl = dbUrl.replace(/user:password@/, 'postgres:password@');
  const sql = postgres(adminUrl, { max: 1 });

  try {
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE;`;
    await sql`DROP SCHEMA IF EXISTS public CASCADE;`;
    await sql`CREATE SCHEMA public;`;
    await sql`GRANT ALL ON SCHEMA public TO "user";`;
    await sql`GRANT ALL ON SCHEMA public TO PUBLIC;`;
    console.log('✅ Dropped drizzle/public, recreated public, granted permissions');
  } catch (error) {
    console.error('❌ reset-db failed', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
