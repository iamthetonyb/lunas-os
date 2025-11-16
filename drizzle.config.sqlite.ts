import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema/**/*.{ts,tsx}',
  out: './drizzle/sqlite',
  dbCredentials: { url: process.env.SQLITE_PATH ?? '.data/lunas.db' },
  verbose: true,
});
