import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./db/schema/**/*.ts', './db/schema/*.ts'],
  out: './drizzle/pg',
  dbCredentials: { url: process.env.DATABASE_URL as string },
  verbose: true,
});
