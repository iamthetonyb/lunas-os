// lib/db.ts - Synchronous Postgres-only database client
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

// Fail fast if no DB URL
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// This is completely synchronous — db is the real instance, never a Promise
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
