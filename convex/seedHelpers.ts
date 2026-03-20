/**
 * Seed-only mutations for bulk data import.
 * These accept raw fields needed during seeding (e.g., no service array wrapping).
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createBlueBookEntry = mutation({
    args: {
        startDate: v.optional(v.string()),
        builderId: v.optional(v.id("builders")),
        communityId: v.optional(v.id("communities")),
        lot: v.optional(v.string()),
        modelPlanId: v.optional(v.id("modelPlans")),
        serviceId: v.optional(v.id("services")),
        accountCategoryCode: v.optional(v.string()),
        accountCategoryName: v.optional(v.string()),
        amount: v.optional(v.string()),
        poNumber: v.optional(v.string()),
        status: v.optional(v.string()),
        checkNumber: v.optional(v.string()),
        checkDate: v.optional(v.string()),
        checkTotal: v.optional(v.string()),
        isAch: v.optional(v.boolean()),
        source: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("blueBookEntries", {
            ...args,
            createdAt: Date.now(),
        });
        return { id };
    },
});

export const createJobRequestRaw = mutation({
    args: {
        receivedVia: v.optional(v.string()),
        requestedBy: v.optional(v.string()),
        contactPhone: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        builderId: v.optional(v.id("builders")),
        communityId: v.optional(v.id("communities")),
        lot: v.optional(v.string()),
        address: v.optional(v.string()),
        modelPlanId: v.optional(v.id("modelPlans")),
        dueDate: v.optional(v.string()),
        notes: v.optional(v.string()),
        poNumber: v.optional(v.string()),
        createdById: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("jobRequests", {
            ...args,
            createdAt: Date.now(),
        });
        return { id };
    },
});

export const createJobRequestService = mutation({
    args: {
        jobRequestId: v.id("jobRequests"),
        serviceId: v.optional(v.id("services")),
        serviceName: v.optional(v.string()),
        walkTime: v.optional(v.string()),
        assignedForemanName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("jobRequestServices", {
            ...args,
            status: "PENDING",
            createdAt: Date.now(),
        });
        return { id };
    },
});

export const upsertCrew = mutation({
    args: {
        name: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if crew already exists by name
        const existing = await ctx.db.query("crews").collect();
        const match = existing.find(c => c.name === args.name);
        if (match) return { id: match._id, existed: true };
        const id = await ctx.db.insert("crews", {
            name: args.name,
            createdAt: Date.now(),
        });
        return { id, existed: false };
    },
});

export const linkCommunitiesToBuilder = mutation({
    args: {
        builderName: v.string(),
    },
    handler: async (ctx, args) => {
        // Find the builder by name
        const builders = await ctx.db.query("builders").collect();
        const builder = builders.find(b => b.name === args.builderName);
        if (!builder) return { updated: 0, error: `Builder "${args.builderName}" not found` };

        // Find communities without a builderId and link them
        const communities = await ctx.db.query("communities").collect();
        let updated = 0;
        for (const community of communities) {
            if (!community.builderId) {
                await ctx.db.patch(community._id, { builderId: builder._id });
                updated++;
            }
        }
        return { updated, builderId: builder._id };
    },
});

export const createDispatchBatchRaw = mutation({
    args: {
        serviceDate: v.optional(v.string()),
        status: v.string(),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("dispatchBatches", {
            ...args,
            createdAt: Date.now(),
        });
        return { id };
    },
});
