// drizzle/migrate.ts - Development-only migration runner (manual execution)
import { db } from "@/lib/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("Skipping migrations in production");
    return;
  }
  console.log("Running Drizzle migrations in development...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
