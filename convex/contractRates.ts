import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const VALID_BASES = ["per_lot", "per_sqft", "per_unit", "flat"] as const;

function validateRateArgs(args: { rate?: string; effectiveOn?: string; expiresOn?: string; basis?: string }) {
    if (args.rate && isNaN(parseFloat(args.rate))) {
        throw new Error("Rate must be a numeric value");
    }
    if (args.effectiveOn && !/^\d{4}-\d{2}-\d{2}/.test(args.effectiveOn)) {
        throw new Error("effectiveOn must be ISO-8601 format (YYYY-MM-DD)");
    }
    if (args.expiresOn && !/^\d{4}-\d{2}-\d{2}/.test(args.expiresOn)) {
        throw new Error("expiresOn must be ISO-8601 format (YYYY-MM-DD)");
    }
    if (args.basis && !(VALID_BASES as readonly string[]).includes(args.basis)) {
        throw new Error(`Invalid basis. Must be one of: ${VALID_BASES.join(", ")}`);
    }
}

export const list = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const rates = await ctx.db.query("contractRates").take(args.limit ?? 1000);
        return rates.filter((r) => r.active !== false).map((r) => ({
            ...r,
            id: r._id,
        }));
    },
});

export const getByBuilder = query({
    args: { builderId: v.id("builders") },
    handler: async (ctx, args) => {
        const rates = await ctx.db
            .query("contractRates")
            .withIndex("by_builder", (q) => q.eq("builderId", args.builderId))
            .collect();
        return rates.filter((r) => r.active !== false).map((r) => ({
            ...r,
            id: r._id,
        }));
    },
});

export const getByService = query({
    args: { serviceId: v.id("services") },
    handler: async (ctx, args) => {
        const rates = await ctx.db
            .query("contractRates")
            .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
            .collect();
        return rates.filter((r) => r.active !== false).map((r) => ({
            ...r,
            id: r._id,
        }));
    },
});

export const getByBuilderAndService = query({
    args: {
        builderId: v.id("builders"),
        serviceId: v.id("services"),
    },
    handler: async (ctx, args) => {
        const rates = await ctx.db
            .query("contractRates")
            .withIndex("by_builder_service", (q) =>
                q.eq("builderId", args.builderId).eq("serviceId", args.serviceId)
            )
            .collect();
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
        validateRateArgs(args);
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
        validateRateArgs(updates);
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
