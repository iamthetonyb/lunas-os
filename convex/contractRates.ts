import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    handler: async (ctx) => {
        const rates = await ctx.db.query("contractRates").collect();
        return rates.filter((r) => r.active !== false).map((r) => ({
            ...r,
            id: r._id,
        }));
    },
});

export const create = mutation({
    args: {
        builderId: v.optional(v.id("builders")),
        serviceId: v.optional(v.id("services")),
        modelPlanId: v.optional(v.id("modelPlans")),
        basis: v.optional(v.string()),
        rate: v.optional(v.string()),
        unitLabel: v.optional(v.string()),
        effectiveOn: v.optional(v.string()),
        expiresOn: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("contractRates", {
            ...args,
            active: true,
            createdAt: Date.now(),
        });
        return { success: true, id };
    },
});

export const update = mutation({
    args: {
        id: v.id("contractRates"),
        builderId: v.optional(v.id("builders")),
        serviceId: v.optional(v.id("services")),
        modelPlanId: v.optional(v.id("modelPlans")),
        basis: v.optional(v.string()),
        rate: v.optional(v.string()),
        unitLabel: v.optional(v.string()),
        effectiveOn: v.optional(v.string()),
        expiresOn: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const filtered: Record<string, any> = {};
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) filtered[k] = val;
        }
        await ctx.db.patch(id, filtered);
        return { success: true };
    },
});

export const remove = mutation({
    args: { id: v.id("contractRates") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { active: false });
        return { success: true };
    },
});
