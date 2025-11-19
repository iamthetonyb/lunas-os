// drizzle/migrate.ts — standalone script, never imported by the app
import { db } from "@/lib/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function run() {
  console.log("Applying migrations...");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Done");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
