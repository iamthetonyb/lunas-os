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
