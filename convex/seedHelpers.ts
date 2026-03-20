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
