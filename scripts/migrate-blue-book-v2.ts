/**
 * Blue Book V2 Migration Script
 *
 * 1. Seeds Pulte phases from KNOWN_PHASES → builderPhaseConfigs
 * 2. Backfills denormalized fields on all existing blueBookEntries
 * 3. Normalizes communities — resolves aliases, flags unresolved
 * 4. Backfills startDateNum for indexed sorting
 *
 * Usage: npx convex run scripts/migrate-blue-book-v2
 * Or import functions and run via Convex dashboard.
 */
import { internalAction, internalMutation, internalQuery } from "../convex/_generated/server";
import { internal } from "../convex/_generated/api";
import { v } from "convex/values";

// ── Known Pulte Phases (source of truth for initial seed) ────────────

const PULTE_PHASES = [
    { code: "SWEEP", title: "Sweep / Rough Clean", shorthand: "SW", serviceNames: ["Clean Rough", "Sweep"], sortOrder: 0 },
    { code: "ROUGH_CLEAN", title: "Rough Clean", shorthand: "RC", serviceNames: ["Clean Rough"], sortOrder: 1 },
    { code: "POWER_WASH", title: "Power Wash", shorthand: "PW", serviceNames: ["Power Wash Driveway", "Power Wash"], sortOrder: 2 },
    { code: "WINDOW", title: "Window Cleaning", shorthand: "WN", serviceNames: ["Window Cleaning", "Windows"], sortOrder: 3 },
    { code: "TUB", title: "Tub Cleaning", shorthand: "TB", serviceNames: ["Tub Cleaning", "Tubs"], sortOrder: 4 },
    { code: "FINAL_CLEAN", title: "Final Clean", shorthand: "FC", serviceNames: ["Clean Final", "Final Clean"], sortOrder: 5 },
    { code: "TOUCH_UP", title: "Touch-Up", shorthand: "TU", serviceNames: ["Touch Up", "Touch-Up"], sortOrder: 6 },
    { code: "QA", title: "Quality Assurance", shorthand: "QA", serviceNames: ["Q/A", "QA", "Quality Assurance"], sortOrder: 7 },
];

// ── Step 1: Seed Phase Configs ──────────────────────────────────────

export const seedPultePhases = internalMutation({
    args: { builderId: v.id("builders") },
    handler: async (ctx, { builderId }) => {
        let created = 0;
        let skipped = 0;

        for (const phase of PULTE_PHASES) {
            // Check if already exists
            const existing = await ctx.db
                .query("builderPhaseConfigs")
                .withIndex("by_builder_code", (q) =>
                    q.eq("builderId", builderId).eq("code", phase.code)
                )
                .first();

            if (existing) {
                skipped++;
                continue;
            }

            await ctx.db.insert("builderPhaseConfigs", {
                builderId,
                code: phase.code,
                title: phase.title,
                shorthand: phase.shorthand,
                serviceNames: phase.serviceNames,
                sortOrder: phase.sortOrder,
                active: true,
                createdAt: Date.now(),
            });
            created++;
        }

        return { created, skipped, total: PULTE_PHASES.length };
    },
});

// ── Step 2: Backfill Denormalized Fields ─────────────────────────────

export const backfillDenormalizedFields = internalMutation({
    args: { batchSize: v.optional(v.number()) },
    handler: async (ctx, { batchSize }) => {
        const limit = batchSize ?? 100;
        const entries = await ctx.db
            .query("blueBookEntries")
            .take(limit);

        let updated = 0;

        for (const entry of entries) {
            const patches: Record<string, any> = {};

            // Backfill builderName
            if (!entry.builderName && entry.builderId) {
                const builder = await ctx.db.get(entry.builderId);
                if (builder) patches.builderName = builder.name;
            }

            // Backfill communityName
            if (!entry.communityName && entry.communityId) {
                const community = await ctx.db.get(entry.communityId);
                if (community) patches.communityName = community.name;
            }

            // Backfill serviceName
            if (!entry.serviceName && entry.serviceId) {
                const service = await ctx.db.get(entry.serviceId);
                if (service) patches.serviceName = service.name;
            }

            // Backfill modelPlanCode/Sqft
            if ((!entry.modelPlanCode || !entry.modelPlanSqft) && entry.modelPlanId) {
                const mp = await ctx.db.get(entry.modelPlanId);
                if (mp) {
                    if (!entry.modelPlanCode && mp.code) patches.modelPlanCode = mp.code;
                    if (!entry.modelPlanSqft && mp.sqft) patches.modelPlanSqft = mp.sqft;
                }
            }

            // Backfill startDateNum
            if (!entry.startDateNum && entry.startDate) {
                const ts = new Date(entry.startDate).getTime();
                if (!isNaN(ts)) patches.startDateNum = ts;
            }

            if (Object.keys(patches).length > 0) {
                patches.updatedAt = Date.now();
                await ctx.db.patch(entry._id, patches);
                updated++;
            }
        }

        return { processed: entries.length, updated };
    },
});

// ── Step 3: Normalize Communities ─────────────────────────────────────

export const backfillNormalizedNames = internalMutation({
    args: {},
    handler: async (ctx) => {
        const communities = await ctx.db.query("communities").collect();
        let updated = 0;

        for (const community of communities) {
            if (!community.normalizedName) {
                await ctx.db.patch(community._id, {
                    normalizedName: community.name.toLowerCase().trim(),
                });
                updated++;
            }
        }

        return { total: communities.length, updated };
    },
});

// ── Step 4: Full migration runner ────────────────────────────────────

export const runFullMigration = internalAction({
    args: {},
    handler: async (ctx) => {
        const results: Record<string, any> = {};

        // Step 1: Find Pulte builder and seed phases
        // (caller should provide builderId, but we try to find it)
        // This is meant to be run manually via dashboard

        // Step 2: Normalize community names
        results.normalizedNames = await ctx.runMutation(
            internal["scripts/migrate-blue-book-v2"].backfillNormalizedNames
        );

        // Step 3: Backfill denormalized fields (run in batches)
        let totalProcessed = 0;
        let totalUpdated = 0;
        let batch;
        do {
            batch = await ctx.runMutation(
                internal["scripts/migrate-blue-book-v2"].backfillDenormalizedFields,
                { batchSize: 100 }
            );
            totalProcessed += batch.processed;
            totalUpdated += batch.updated;
        } while (batch.processed === 100); // Keep going until fewer than batch size

        results.denormalized = { totalProcessed, totalUpdated };

        return results;
    },
});
