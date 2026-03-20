/**
 * Blue Book Phase Config — CRUD for per-builder phase definitions.
 * Replaces hardcoded KNOWN_PHASES with DB-backed configs.
 */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Queries ─────────────────────────────────────────────────────────

export const getByBuilder = query({
    args: { builderId: v.id("builders") },
    handler: async (ctx, args) => {
        const phases = await ctx.db
            .query("builderPhaseConfigs")
            .withIndex("by_builder", (q) => q.eq("builderId", args.builderId))
            .collect();
        return phases
            .filter((p) => p.active)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    },
});

export const getByBuilderCode = query({
    args: { builderId: v.id("builders"), code: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("builderPhaseConfigs")
            .withIndex("by_builder_code", (q) =>
                q.eq("builderId", args.builderId).eq("code", args.code)
            )
            .first();
    },
});

export const listAll = query({
    handler: async (ctx) => {
        const phases = await ctx.db.query("builderPhaseConfigs").collect();
        return phases.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder);
    },
});

// ── Mutations ───────────────────────────────────────────────────────

export const create = mutation({
    args: {
        builderId: v.id("builders"),
        code: v.string(),
        title: v.string(),
        shorthand: v.string(),
        serviceNames: v.array(v.string()),
        sortOrder: v.number(),
    },
    handler: async (ctx, args) => {
        // Check for duplicate code per builder
        const existing = await ctx.db
            .query("builderPhaseConfigs")
            .withIndex("by_builder_code", (q) =>
                q.eq("builderId", args.builderId).eq("code", args.code)
            )
            .first();
        if (existing) {
            throw new Error(`Phase code "${args.code}" already exists for this builder`);
        }

        const id = await ctx.db.insert("builderPhaseConfigs", {
            ...args,
            active: true,
            createdAt: Date.now(),
        });
        return { id };
    },
});

export const update = mutation({
    args: {
        id: v.id("builderPhaseConfigs"),
        title: v.optional(v.string()),
        shorthand: v.optional(v.string()),
        serviceNames: v.optional(v.array(v.string())),
        sortOrder: v.optional(v.number()),
        active: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const filtered: Record<string, any> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) filtered[k] = val;
        }
        await ctx.db.patch(id, filtered);
        return { success: true };
    },
});

export const remove = mutation({
    args: { id: v.id("builderPhaseConfigs") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { active: false, updatedAt: Date.now() });
        return { success: true };
    },
});

// ── Phase Overrides (replaces localStorage) ─────────────────────────

export const getOverrides = query({
    args: { lotKey: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("phaseOverrides")
            .withIndex("by_lotKey", (q) => q.eq("lotKey", args.lotKey))
            .collect();
    },
});

export const getOverridesByBuilderCommunity = query({
    args: {
        builderId: v.id("builders"),
        communityId: v.id("communities"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("phaseOverrides")
            .withIndex("by_builder_community", (q) =>
                q.eq("builderId", args.builderId).eq("communityId", args.communityId)
            )
            .collect();
    },
});

export const getOverridesByBuilder = query({
    args: {
        builderId: v.id("builders"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("phaseOverrides")
            .withIndex("by_builder_community", (q) =>
                q.eq("builderId", args.builderId)
            )
            .collect();
    },
});

/**
 * Seed default Pulte phases if none exist for a builder.
 * Safe to call multiple times — only inserts if builder has 0 phases.
 */
export const seedDefaults = mutation({
    args: { builderId: v.id("builders") },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("builderPhaseConfigs")
            .withIndex("by_builder", (q) => q.eq("builderId", args.builderId))
            .first();
        if (existing) return { seeded: false, message: "Phases already exist" };

        const defaults = [
            {
                code: "22702",
                title: "22702 – T3",
                shorthand: "T3",
                serviceNames: ["Frame Sweep"],
                sortOrder: 1,
            },
            {
                code: "22712",
                title: "22712 – T2",
                shorthand: "T2",
                serviceNames: ["Tubs & Windows", "Q/A", "Power Wash"],
                sortOrder: 2,
            },
            {
                code: "22714",
                title: "22714 – T1",
                shorthand: "T1",
                serviceNames: ["Final Clean", "Touch up Clean"],
                sortOrder: 3,
            },
        ];

        const now = Date.now();
        for (const phase of defaults) {
            await ctx.db.insert("builderPhaseConfigs", {
                builderId: args.builderId,
                ...phase,
                active: true,
                createdAt: now,
            });
        }
        return { seeded: true, count: defaults.length };
    },
});

export const setOverride = mutation({
    args: {
        builderId: v.id("builders"),
        communityId: v.id("communities"),
        lot: v.string(),
        phaseCode: v.string(),
        phaseComplete: v.optional(v.boolean()),
        serviceOverrides: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const lotKey = `${args.communityId}:${args.lot}`;
        const now = Date.now();

        // Find existing override for this lot+phase
        const existing = await ctx.db
            .query("phaseOverrides")
            .withIndex("by_lotKey", (q) => q.eq("lotKey", lotKey))
            .filter((q) => q.eq(q.field("phaseCode"), args.phaseCode))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                phaseComplete: args.phaseComplete,
                serviceOverrides: args.serviceOverrides,
                updatedAt: now,
            });
            return { id: existing._id };
        }

        const id = await ctx.db.insert("phaseOverrides", {
            lotKey,
            builderId: args.builderId,
            communityId: args.communityId,
            lot: args.lot,
            phaseCode: args.phaseCode,
            phaseComplete: args.phaseComplete,
            serviceOverrides: args.serviceOverrides,
            createdAt: now,
        });
        return { id };
    },
});
