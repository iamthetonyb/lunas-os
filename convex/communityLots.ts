import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const byCommunity = query({
    args: { communityId: v.id("communities") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("communityLots")
            .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
            .collect();
    },
});

/**
 * Returns all known lot numbers for a community — merged from:
 * 1. communityLots table
 * 2. blueBookEntries (lot field)
 * 3. jobRequests (lot field)
 * Deduplicated and sorted numerically.
 */
export const allLotsByCommunity = query({
    args: { communityId: v.id("communities") },
    handler: async (ctx, args) => {
        const seen = new Set<string>();

        // 1. communityLots table
        const clots = await ctx.db
            .query("communityLots")
            .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
            .collect();
        for (const cl of clots) {
            if (cl.lotNumber) seen.add(cl.lotNumber.trim());
        }

        // 2. blueBookEntries — lot field
        const bbEntries = await ctx.db
            .query("blueBookEntries")
            .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
            .take(2000);
        for (const e of bbEntries) {
            if (e.lot) seen.add(e.lot.trim());
        }

        // 3. jobRequests — lot field
        const jrs = await ctx.db
            .query("jobRequests")
            .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
            .take(2000);
        for (const jr of jrs) {
            if (jr.lot) seen.add(jr.lot.trim());
        }

        // Sort numerically where possible
        const lots = [...seen].filter(Boolean).sort((a, b) => {
            const na = parseInt(a, 10);
            const nb = parseInt(b, 10);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
        });

        return lots;
    },
});

export const byModelPlan = query({
    args: { modelPlanId: v.id("modelPlans") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("communityLots")
            .withIndex("by_modelPlan", (q) => q.eq("modelPlanId", args.modelPlanId))
            .collect();
    },
});

export const create = mutation({
    args: {
        communityId: v.id("communities"),
        modelPlanId: v.optional(v.id("modelPlans")),
        lotNumber: v.optional(v.string()),
        jobNumber: v.optional(v.string()),
        address: v.optional(v.string()),
        model: v.optional(v.string()),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("communityLots", {
            communityId: args.communityId,
            modelPlanId: args.modelPlanId,
            lotNumber: args.lotNumber?.trim() || undefined,
            jobNumber: args.jobNumber?.trim() || undefined,
            address: args.address?.trim() || undefined,
            model: args.model?.trim() || undefined,
            status: args.status || "active",
            createdAt: Date.now(),
        });
        return { id };
    },
});

export const update = mutation({
    args: {
        id: v.id("communityLots"),
        lotNumber: v.optional(v.string()),
        jobNumber: v.optional(v.string()),
        address: v.optional(v.string()),
        model: v.optional(v.string()),
        modelPlanId: v.optional(v.id("modelPlans")),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const filtered: Record<string, any> = {};
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) filtered[k] = typeof val === "string" ? val.trim() : val;
        }
        await ctx.db.patch(id, filtered);
        return { success: true };
    },
});

export const remove = mutation({
    args: { id: v.id("communityLots") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return { success: true };
    },
});
