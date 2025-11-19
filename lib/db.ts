// lib/db.ts - Synchronous Postgres-only database client
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

// This is synchronous — db is the real instance, NOT a Promise
const client = postgres(process.env.DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });

// Run migrations ONLY in development and ONLY once at startup (never blocks the export)
if (process.env.NODE_ENV !== "production") {
  import("../drizzle/migrate").then((mod) => mod.runMigrations()).catch(console.error);
}
