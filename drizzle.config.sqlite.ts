import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './db/migrations-sqlite',
  schema: './db/schema/index.ts',
  dialect: 'sqlite',
  dbCredentials: { 
    url: process.env.SQLITE_PATH ?? 'dev.db'
  },
  strict: true,
  verbose: true,
});
