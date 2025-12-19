// drizzle/migrate.ts — standalone script, never imported by the app
import { db } from "@/lib/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";

async function run() {
  console.log("Applying migrations...");
  // Explicitly point to the postgres migrations folder
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle/pg") });
  console.log("Done");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
