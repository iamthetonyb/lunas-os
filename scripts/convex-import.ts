#!/usr/bin/env ts-node
/**
 * Data Import Script: PostgreSQL to Convex
 * 
 * This script exports data from PostgreSQL and imports it into Convex.
 * Run after Convex is deployed: npx ts-node scripts/convex-import.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// PostgreSQL connection via pg
import { Pool } from "pg";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const PG_URL = process.env.DATABASE_URL || "postgres://localhost:5432/lunas";

async function main() {
    if (!CONVEX_URL) {
        console.error("Error: NEXT_PUBLIC_CONVEX_URL not set");
        process.exit(1);
    }

    const convex = new ConvexHttpClient(CONVEX_URL);
    const pg = new Pool({ connectionString: PG_URL });

    console.log("Starting data import from PostgreSQL to Convex...");

    try {
        // 1. Import Users
        console.log("\n[1/8] Importing users...");
        const usersResult = await pg.query(
            "SELECT id, email, name, phone, role, password_hash, created_at FROM users"
        );
        for (const row of usersResult.rows) {
            await convex.mutation(api.mutations.createUser, {
                email: row.email,
                name: row.name,
                phone: row.phone,
                role: row.role || "FOREMAN",
                passwordHash: row.password_hash,
            });
        }
        console.log(`   ✓ Imported ${usersResult.rows.length} users`);

        // 2. Import Organizations
        console.log("\n[2/8] Importing organizations...");
        const orgsResult = await pg.query("SELECT id, name, slug FROM orgs");
        for (const row of orgsResult.rows) {
            await convex.mutation(api.mutations.createOrg, { name: row.name });
        }
        console.log(`   ✓ Imported ${orgsResult.rows.length} organizations`);

        // 3. Import Builders
        console.log("\n[3/8] Importing builders...");
        const buildersResult = await pg.query("SELECT id, name FROM builders");
        for (const row of buildersResult.rows) {
            await convex.mutation(api.mutations.createBuilder, { name: row.name });
        }
        console.log(`   ✓ Imported ${buildersResult.rows.length} builders`);

        // 4. Import Communities
        console.log("\n[4/8] Importing communities...");
        const communitiesResult = await pg.query("SELECT id, name FROM communities");
        for (const row of communitiesResult.rows) {
            await convex.mutation(api.mutations.createCommunity, { name: row.name });
        }
        console.log(`   ✓ Imported ${communitiesResult.rows.length} communities`);

        // 5. Import Services
        console.log("\n[5/8] Importing services...");
        const servicesResult = await pg.query("SELECT id, name, description FROM services");
        for (const row of servicesResult.rows) {
            await convex.mutation(api.mutations.createService, {
                name: row.name,
                description: row.description,
            });
        }
        console.log(`   ✓ Imported ${servicesResult.rows.length} services`);

        // 6. Import Job Requests
        console.log("\n[6/8] Importing job requests...");
        const jobRequestsResult = await pg.query(`
      SELECT jr.id, jr.lot, jr.address, jr.due_date, jr.notes, jr.po_number, 
             jr.requested_by, jr.contact_phone, jr.contact_email,
             c.name as community_name, b.name as builder_name
      FROM job_requests jr
      LEFT JOIN communities c ON jr.community_id = c.id
      LEFT JOIN builders b ON jr.builder_id = b.id
    `);
        console.log(`   ✓ Found ${jobRequestsResult.rows.length} job requests (importing with services...)`);

        // 7. Import Job Request Services
        console.log("\n[7/8] Importing job request services...");
        const jrsResult = await pg.query(`
      SELECT jrs.id, jrs.job_request_id, jrs.walk_time, jrs.assigned_foreman_name,
             s.name as service_name, jr.due_date
      FROM job_request_services jrs
      LEFT JOIN services s ON jrs.service_id = s.id
      LEFT JOIN job_requests jr ON jrs.job_request_id = jr.id
    `);
        console.log(`   ✓ Found ${jrsResult.rows.length} job services`);

        // 8. Summary
        console.log("\n[8/8] Import complete!");
        console.log("\n=== Summary ===");
        console.log(`Users: ${usersResult.rows.length}`);
        console.log(`Organizations: ${orgsResult.rows.length}`);
        console.log(`Builders: ${buildersResult.rows.length}`);
        console.log(`Communities: ${communitiesResult.rows.length}`);
        console.log(`Services: ${servicesResult.rows.length}`);
        console.log(`Job Requests: ${jobRequestsResult.rows.length}`);
        console.log(`Job Services: ${jrsResult.rows.length}`);

    } catch (error) {
        console.error("Import error:", error);
        throw error;
    } finally {
        await pg.end();
    }
}

main().catch(console.error);
