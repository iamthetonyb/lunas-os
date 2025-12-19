// lib/db.ts — THIS IS THE FINAL VERSION — DO NOT CHANGE ANYTHING
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";

const connectionString = process.env.DATABASE_URL ?? "";

if (!connectionString) {
  throw new Error("DATABASE_URL is missing or empty");
}

// This is 100% synchronous — no async, no await, no imports that could cause top-level await
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

export { db };
