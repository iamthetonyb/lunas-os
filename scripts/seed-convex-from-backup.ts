/**
 * Seed Convex from PostgreSQL backup file.
 * Parses COPY blocks from pg_dump output and inserts into Convex
 * in dependency order, maintaining UUID→ConvexId mapping.
 *
 * Usage: pnpm tsx scripts/seed-convex-from-backup.ts
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import * as fs from "fs";
import * as path from "path";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;
if (!CONVEX_URL) {
    console.error("NEXT_PUBLIC_CONVEX_URL must be set");
    process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

// UUID → Convex ID mapping
const idMap = new Map<string, string>();

function mapId<T extends string>(table: T, uuid: string): Id<any> | undefined {
    const mapped = idMap.get(uuid);
    return mapped as Id<any> | undefined;
}

// ── SQL Parser ────────────────────────────────────────────────────────

function parseCopyBlocks(sql: string): Map<string, { columns: string[]; rows: string[][] }> {
    const blocks = new Map<string, { columns: string[]; rows: string[][] }>();
    const lines = sql.split('\n');

    let currentTable: string | null = null;
    let currentColumns: string[] = [];
    let currentRows: string[][] = [];

    for (const line of lines) {
        // Match COPY public.tablename (col1, col2, ...) FROM stdin;
        const copyMatch = line.match(/^COPY public\.(\w+)\s*\((.+?)\)\s*FROM stdin;/);
        if (copyMatch) {
            currentTable = copyMatch[1];
            currentColumns = copyMatch[2].split(',').map((c) => c.trim().replace(/"/g, ''));
            currentRows = [];
            continue;
        }

        // End of COPY block
        if (line === '\\.' && currentTable) {
            blocks.set(currentTable, { columns: currentColumns, rows: currentRows });
            currentTable = null;
            continue;
        }

        // Data row (tab-separated)
        if (currentTable && line.length > 0) {
            currentRows.push(line.split('\t'));
        }
    }

    return blocks;
}

function val(raw: string): string | null {
    return raw === '\\N' ? null : raw;
}

function tsToMs(pgTimestamp: string | null): number {
    if (!pgTimestamp) return Date.now();
    const d = new Date(pgTimestamp);
    return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

// ── Seeders ───────────────────────────────────────────────────────────

async function seedUsers(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} users...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const result = await convex.mutation(api.mutations.createUser, {
            email: val(row[ci('email')]) ?? '',
            name: val(row[ci('name')]) ?? undefined,
            phone: val(row[ci('phone')]) ?? undefined,
            role: val(row[ci('role')]) ?? 'CREW',
            passwordHash: val(row[ci('password_hash')]) ?? undefined,
        });
        idMap.set(uuid, result.userId as string);
        console.log(`  User: ${val(row[ci('name')])} (${val(row[ci('email')])})`);
    }
}

async function seedOrgs(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} orgs...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const result = await convex.mutation(api.mutations.createOrg, {
            name: val(row[ci('name')]) ?? '',
        });
        idMap.set(uuid, result.orgId as string);
        console.log(`  Org: ${val(row[ci('name')])}`);
    }
}

async function seedOrgMembers(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} org members...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const orgId = mapId("orgs", row[ci('org_id')]);
        const userId = mapId("users", row[ci('user_id')]);
        if (!orgId || !userId) {
            console.warn(`  Skipping org member - missing mapping: org=${row[ci('org_id')]}, user=${row[ci('user_id')]}`);
            continue;
        }
        await convex.mutation(api.mutations.assignOrgMembership, {
            orgId: orgId as Id<"orgs">,
            userId: userId as Id<"users">,
            role: val(row[ci('role')]) ?? 'contractor',
        });
        console.log(`  Member: user=${row[ci('user_id')].slice(0, 8)}... -> org=${row[ci('org_id')].slice(0, 8)}...`);
    }
}

async function seedBuilders(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} builders...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const result = await convex.mutation(api.mutations.createBuilder, {
            name: val(row[ci('name')]) ?? '',
        });
        idMap.set(uuid, result.id as string);
        console.log(`  Builder: ${val(row[ci('name')])}`);
    }
}

async function seedCommunities(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} communities...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const builderUuid = val(row[ci('builder_id')]);
        const builderId = builderUuid ? mapId("builders", builderUuid) : undefined;

        const result = await convex.mutation(api.mutations.createCommunity, {
            name: val(row[ci('name')]) ?? '',
            builderId: builderId as Id<"builders"> | undefined,
        });
        idMap.set(uuid, result.id as string);
        console.log(`  Community: ${val(row[ci('name')])}`);
    }
}

async function seedServices(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} services...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const result = await convex.mutation(api.mutations.createService, {
            name: val(row[ci('name')]) ?? '',
            code: val(row[ci('code')]) ?? undefined,
            category: val(row[ci('category')]) ?? undefined,
            unitKind: val(row[ci('unit_kind')]) ?? undefined,
        });
        idMap.set(uuid, result.id as string);
        console.log(`  Service: ${val(row[ci('code')])} - ${val(row[ci('name')])}`);
    }
}

async function seedModelPlans(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} model plans...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const builderUuid = val(row[ci('builder_id')]);
        const builderId = builderUuid ? mapId("builders", builderUuid) : undefined;

        const result = await convex.mutation(api.mutations.createModelPlan, {
            name: val(row[ci('name')]) ?? '',
            builderId: builderId as Id<"builders"> | undefined,
            code: val(row[ci('code')]) ?? undefined,
            sqft: val(row[ci('sqft')]) ?? undefined,
        });
        idMap.set(uuid, result.id as string);
        console.log(`  Model Plan: ${val(row[ci('code')])} - ${val(row[ci('name')])}`);
    }
}

async function seedCrews(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} crews...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const foremanUuid = val(row[ci('foreman_id')]);
        const foremanId = foremanUuid ? mapId("users", foremanUuid) : undefined;
        const skillsRaw = val(row[ci('skills')]);
        const skills = skillsRaw ? skillsRaw.replace(/[{}]/g, '').split(',').filter(Boolean) : undefined;
        const cap = val(row[ci('capacity_per_day')]);

        const result = await convex.mutation(api.mutations.createCrew, {
            name: val(row[ci('name')]) ?? '',
            foremanId: foremanId as Id<"users"> | undefined,
            skills: skills?.length ? skills : undefined,
            capacityPerDay: cap ? parseInt(cap) : undefined,
        });
        idMap.set(uuid, result.id as string);
        console.log(`  Crew: ${val(row[ci('name')])}`);
    }
}

async function seedBlueBookEntries(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} blue book entries...`);
    const ci = (col: string) => data.columns.indexOf(col);

    // Use direct insert via internal mutation since we need all fields
    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const builderUuid = val(row[ci('builder_id')]);
        const communityUuid = val(row[ci('community_id')]);
        const serviceUuid = val(row[ci('service_id')]);
        const modelPlanUuid = val(row[ci('model_plan_id')]);

        const builderId = builderUuid ? mapId("builders", builderUuid) : undefined;
        const communityId = communityUuid ? mapId("communities", communityUuid) : undefined;
        const serviceId = serviceUuid ? mapId("services", serviceUuid) : undefined;
        const modelPlanId = modelPlanUuid ? mapId("modelPlans", modelPlanUuid) : undefined;

        // We need a direct insert mutation for blue book entries
        // For now we'll use the Convex HTTP client's mutation
        // This requires a createBlueBookEntry mutation
        const entry = {
            startDate: val(row[ci('start_date')]) ?? undefined,
            builderId: builderId as Id<"builders"> | undefined,
            communityId: communityId as Id<"communities"> | undefined,
            lot: val(row[ci('lot')]) ?? undefined,
            modelPlanId: modelPlanId as Id<"modelPlans"> | undefined,
            serviceId: serviceId as Id<"services"> | undefined,
            accountCategoryCode: val(row[ci('account_category_code')]) ?? undefined,
            accountCategoryName: val(row[ci('account_category_name')]) ?? undefined,
            amount: val(row[ci('amount')]) ?? undefined,
            poNumber: val(row[ci('po_number')]) ?? undefined,
            status: val(row[ci('status')]) ?? undefined,
            checkNumber: val(row[ci('check_number')]) ?? undefined,
            checkDate: val(row[ci('check_date')]) ?? undefined,
            checkTotal: val(row[ci('check_total')]) ?? undefined,
            isAch: val(row[ci('is_ach')]) === 't',
            source: val(row[ci('source')]) ?? undefined,
        };

        const result = await convex.mutation(api.seedHelpers.createBlueBookEntry, entry);
        idMap.set(uuid, result.id as string);
    }
    console.log(`  Inserted ${data.rows.length} blue book entries`);
}

async function seedJobRequests(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} job requests...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const builderUuid = val(row[ci('builder_id')]);
        const communityUuid = val(row[ci('community_id')]);
        const modelPlanUuid = val(row[ci('model_plan_id')]);
        const createdByUuid = val(row[ci('created_by_id')]);

        const result = await convex.mutation(api.seedHelpers.createJobRequestRaw, {
            receivedVia: val(row[ci('received_via')]) ?? undefined,
            requestedBy: val(row[ci('requested_by')]) ?? undefined,
            contactPhone: val(row[ci('contact_phone')]) ?? undefined,
            contactEmail: val(row[ci('contact_email')]) ?? undefined,
            builderId: (builderUuid ? mapId("builders", builderUuid) : undefined) as Id<"builders"> | undefined,
            communityId: (communityUuid ? mapId("communities", communityUuid) : undefined) as Id<"communities"> | undefined,
            lot: val(row[ci('lot')]) ?? undefined,
            address: val(row[ci('address')]) ?? undefined,
            modelPlanId: (modelPlanUuid ? mapId("modelPlans", modelPlanUuid) : undefined) as Id<"modelPlans"> | undefined,
            dueDate: val(row[ci('due_date')]) ?? undefined,
            notes: val(row[ci('notes')]) ?? undefined,
            poNumber: val(row[ci('po_number')]) ?? undefined,
            createdById: (createdByUuid ? mapId("users", createdByUuid) : undefined) as Id<"users"> | undefined,
        });
        idMap.set(uuid, result.id as string);
        console.log(`  Job Request: ${val(row[ci('lot')])} at community ${row[ci('community_id')]?.slice(0, 8)}...`);
    }
}

async function seedJobRequestServices(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} job request services...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const jrUuid = row[ci('job_request_id')];
        const serviceUuid = val(row[ci('service_id')]);

        const jobRequestId = mapId("jobRequests", jrUuid);
        if (!jobRequestId) {
            console.warn(`  Skipping JRS - missing job request mapping: ${jrUuid}`);
            continue;
        }

        const serviceId = serviceUuid ? mapId("services", serviceUuid) : undefined;

        // Get service name for denormalization
        let serviceName: string | undefined;
        if (serviceId) {
            const services = await convex.query(api.queries.getServices, {});
            const svc = services.find((s: any) => s._id === serviceId);
            serviceName = svc?.name;
        }

        const result = await convex.mutation(api.seedHelpers.createJobRequestService, {
            jobRequestId: jobRequestId as Id<"jobRequests">,
            serviceId: serviceId as Id<"services"> | undefined,
            serviceName,
            walkTime: val(row[ci('walk_time')]) ?? undefined,
            assignedForemanName: val(row[ci('assigned_foreman_name')]) ?? undefined,
        });
        idMap.set(uuid, result.id as string);
    }
    console.log(`  Inserted ${data.rows.length} job request services`);
}

async function seedDispatchBatches(data: { columns: string[]; rows: string[][] }) {
    console.log(`\nSeeding ${data.rows.length} dispatch batches...`);
    const ci = (col: string) => data.columns.indexOf(col);

    for (const row of data.rows) {
        const uuid = row[ci('id')];
        const result = await convex.mutation(api.seedHelpers.createDispatchBatchRaw, {
            serviceDate: val(row[ci('service_date')]) ?? undefined,
            status: val(row[ci('status')]) ?? 'DRAFT',
            notes: val(row[ci('notes')]) ?? undefined,
        });
        idMap.set(uuid, result.id as string);
        console.log(`  Dispatch Batch: ${val(row[ci('service_date')])} - ${val(row[ci('status')])}`);
    }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
    const backupPath = path.resolve(__dirname, '../backup_postgres_20241217.sql');
    console.log(`Reading backup from: ${backupPath}`);

    const sql = fs.readFileSync(backupPath, 'utf-8');
    const blocks = parseCopyBlocks(sql);

    console.log(`Found ${blocks.size} COPY blocks:`);
    for (const [table, data] of blocks) {
        console.log(`  ${table}: ${data.rows.length} rows`);
    }

    // Seed in dependency order
    const users = blocks.get('users');
    if (users) await seedUsers(users);

    const orgs = blocks.get('orgs');
    if (orgs) await seedOrgs(orgs);

    const orgMembers = blocks.get('org_members');
    if (orgMembers) await seedOrgMembers(orgMembers);

    const builders = blocks.get('builders');
    if (builders) await seedBuilders(builders);

    const communities = blocks.get('communities');
    if (communities) await seedCommunities(communities);

    const services = blocks.get('services');
    if (services) await seedServices(services);

    const modelPlans = blocks.get('model_plans');
    if (modelPlans) await seedModelPlans(modelPlans);

    const crews = blocks.get('crews');
    if (crews) await seedCrews(crews);

    const blueBook = blocks.get('blue_book_entries');
    if (blueBook) await seedBlueBookEntries(blueBook);

    const jobRequests = blocks.get('job_requests');
    if (jobRequests) await seedJobRequests(jobRequests);

    const jobRequestServices = blocks.get('job_request_services');
    if (jobRequestServices) await seedJobRequestServices(jobRequestServices);

    const dispatchBatches = blocks.get('dispatch_batches');
    if (dispatchBatches) await seedDispatchBatches(dispatchBatches);

    console.log(`\nSeed complete! Mapped ${idMap.size} UUIDs to Convex IDs.`);
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
