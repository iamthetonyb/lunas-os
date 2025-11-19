// drizzle/migrate.ts - Development-only migration runner
import { db } from "@/lib/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export async function runMigrations() {
  console.log("Running Drizzle migrations in development...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete");
}
