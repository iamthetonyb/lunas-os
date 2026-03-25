import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

// ── Predefined service types (matching Blue Book phases) ────────────
export const SERVICE_TYPES = [
    "Final Clean",
    "QA",
    "Tubs / Windows",
    "Touch Up Clean",
    "Frame Sweep",
    "Rough Clean",
    "Paint Sweep",
    "NHO",
    "FQI",
    "Move In Clean",
    "After Carpet",
    "Carpet Sweep",
    "Power Wash",
    "Extra Sweep",
    "Extra Clean",
    "Other",
] as const;

// ── Queries ─────────────────────────────────────────────────────────

export const list = query({
    args: {
        callerUserId: v.optional(v.id("users")),
        dateFrom: v.optional(v.string()),
        dateTo: v.optional(v.string()),
        status: v.optional(v.string()),
        communityId: v.optional(v.id("communities")),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        // Permission scoping
        let restrictToUserId: Id<"users"> | null = null;
        if (args.callerUserId) {
            const caller = await ctx.db.get(args.callerUserId);
            if (caller) {
                const role = (caller.role ?? "").toUpperCase();
                if (role !== "ADMIN" && role !== "BACKOFFICE") {
                    restrictToUserId = args.callerUserId;
                }
            }
        }

        let logs: Doc<"workLogs">[];
        if (restrictToUserId) {
            logs = await ctx.db
                .query("workLogs")
                .withIndex("by_user_date", (q) => q.eq("userId", restrictToUserId!))
                .order("desc")
                .take(args.limit ?? 500);
        } else if (args.communityId) {
            logs = await ctx.db
                .query("workLogs")
                .withIndex("by_community", (q) => q.eq("communityId", args.communityId!))
                .order("desc")
                .take(args.limit ?? 500);
        } else if (args.status) {
            logs = await ctx.db
                .query("workLogs")
                .withIndex("by_status", (q) => q.eq("status", args.status!))
                .order("desc")
                .take(args.limit ?? 500);
        } else {
            logs = await ctx.db
                .query("workLogs")
                .withIndex("by_date")
                .order("desc")
                .take(args.limit ?? 500);
        }

        // Date range filter
        if (args.dateFrom) {
            logs = logs.filter((l) => l.date >= args.dateFrom!);
        }
        if (args.dateTo) {
            logs = logs.filter((l) => l.date <= args.dateTo!);
        }

        // Non-admin users only see their own logs
        if (restrictToUserId) {
            logs = logs.filter((l) => l.userId === restrictToUserId);
        }

        return logs.map((l) => ({
            ...l,
            id: l._id,
        }));
    },
});

export const getById = query({
    args: { id: v.id("workLogs") },
    handler: async (ctx, args) => {
        const log = await ctx.db.get(args.id);
        if (!log) return null;
        return { ...log, id: log._id };
    },
});

// Stats for the dashboard/header
export const getStats = query({
    args: {
        callerUserId: v.optional(v.id("users")),
        dateFrom: v.optional(v.string()),
        dateTo: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let logs: Doc<"workLogs">[];
        if (args.callerUserId) {
            const caller = await ctx.db.get(args.callerUserId);
            const role = (caller?.role ?? "").toUpperCase();
            if (role !== "ADMIN" && role !== "BACKOFFICE") {
                logs = await ctx.db
                    .query("workLogs")
                    .withIndex("by_user", (q) => q.eq("userId", args.callerUserId!))
                    .take(5000);
            } else {
                logs = await ctx.db.query("workLogs").take(5000);
            }
        } else {
            logs = await ctx.db.query("workLogs").take(5000);
        }

        if (args.dateFrom) logs = logs.filter((l) => l.date >= args.dateFrom!);
        if (args.dateTo) logs = logs.filter((l) => l.date <= args.dateTo!);

        const submitted = logs.filter((l) => l.status === "SUBMITTED").length;
        const verified = logs.filter((l) => l.status === "VERIFIED").length;
        const flagged = logs.filter((l) => l.status === "FLAGGED").length;
        const totalAmount = logs.reduce((sum, l) => sum + (l.amount ?? 0), 0);
        const extraWork = logs.filter((l) => l.isExtraWork).length;
        const unvalidated = logs.filter((l) => l.assignmentValidated === false).length;

        return { submitted, verified, flagged, totalAmount, extraWork, unvalidated, total: logs.length };
    },
});

// ── Mutations ───────────────────────────────────────────────────────

export const create = mutation({
    args: {
        userId: v.id("users"),
        date: v.string(),
        communityId: v.optional(v.id("communities")),
        serviceType: v.string(),
        lots: v.string(),
        sqft: v.optional(v.number()),
        amount: v.optional(v.number()),
        isExtraWork: v.optional(v.boolean()),
        extraWorkDescription: v.optional(v.string()),
        notes: v.optional(v.string()),
        subContractorName: v.optional(v.string()),
        windowCount: v.optional(v.number()),
        hoursWorked: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        // Validation
        if (!args.date || !/^\d{4}-\d{2}-\d{2}/.test(args.date)) {
            throw new Error("Date must be YYYY-MM-DD format");
        }
        if (!args.lots.trim()) {
            throw new Error("At least one lot is required");
        }
        if (args.isExtraWork && !args.extraWorkDescription?.trim()) {
            throw new Error("Extra work requires a description");
        }

        // Resolve user name
        const user = await ctx.db.get(args.userId);
        const userName = user?.name ?? "Unknown";

        // Resolve community → builder
        let communityName: string | undefined;
        let builderId: Id<"builders"> | undefined;
        let builderName: string | undefined;
        if (args.communityId) {
            const community = await ctx.db.get(args.communityId);
            communityName = community?.name;
            if (community?.builderId) {
                builderId = community.builderId;
                const builder = await ctx.db.get(community.builderId);
                builderName = builder?.name;
            }
        }

        // Validate assignment — check if this user has a matching assignment
        let assignmentValidated = false;
        let jobRequestServiceId: Id<"jobRequestServices"> | undefined;

        // Search for assignments matching this community + service + date
        if (args.communityId) {
            const jrs = await ctx.db
                .query("jobRequestServices")
                .withIndex("by_scheduledDate", (q) => q.eq("scheduledDate", args.date))
                .take(500);

            const userNameLower = userName.toLowerCase();
            for (const svc of jrs) {
                if ((svc.assignedForemanName ?? "").toLowerCase() !== userNameLower) continue;
                if (!(svc.serviceName ?? "").toLowerCase().includes(args.serviceType.toLowerCase())) continue;

                // Check the parent job request is for this community
                const jr = await ctx.db.get(svc.jobRequestId);
                if (jr?.communityId === args.communityId) {
                    assignmentValidated = true;
                    jobRequestServiceId = svc._id;
                    break;
                }
            }
        }

        const status = args.isExtraWork && !assignmentValidated ? "FLAGGED" : "SUBMITTED";
        const flagReason = !assignmentValidated && !args.isExtraWork
            ? "No matching assignment found for this work"
            : args.isExtraWork && !assignmentValidated
            ? "Extra work — requires admin approval"
            : undefined;

        const id = await ctx.db.insert("workLogs", {
            userId: args.userId,
            userName,
            date: args.date,
            communityId: args.communityId,
            communityName,
            builderId,
            builderName,
            serviceType: args.serviceType,
            lots: args.lots,
            sqft: args.sqft,
            amount: args.amount,
            isExtraWork: args.isExtraWork ?? false,
            extraWorkDescription: args.extraWorkDescription,
            notes: args.notes,
            subContractorName: args.subContractorName,
            windowCount: args.windowCount,
            hoursWorked: args.hoursWorked,
            status,
            flagReason,
            assignmentValidated,
            jobRequestServiceId,
            createdAt: Date.now(),
        });

        return { id, status, assignmentValidated, flagReason };
    },
});

export const verify = mutation({
    args: {
        id: v.id("workLogs"),
        verifiedBy: v.id("users"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            status: "VERIFIED",
            verifiedBy: args.verifiedBy,
            verifiedAt: Date.now(),
            updatedAt: Date.now(),
        });
        return { success: true };
    },
});

export const flag = mutation({
    args: {
        id: v.id("workLogs"),
        reason: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            status: "FLAGGED",
            flagReason: args.reason,
            updatedAt: Date.now(),
        });
        return { success: true };
    },
});

export const update = mutation({
    args: {
        id: v.id("workLogs"),
        date: v.optional(v.string()),
        communityId: v.optional(v.id("communities")),
        serviceType: v.optional(v.string()),
        lots: v.optional(v.string()),
        sqft: v.optional(v.number()),
        amount: v.optional(v.number()),
        isExtraWork: v.optional(v.boolean()),
        extraWorkDescription: v.optional(v.string()),
        notes: v.optional(v.string()),
        subContractorName: v.optional(v.string()),
        windowCount: v.optional(v.number()),
        hoursWorked: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const existing = await ctx.db.get(id);
        if (!existing) throw new Error("Work log not found");
        if (existing.status === "VERIFIED") {
            throw new Error("Cannot edit a verified work log");
        }

        const filtered: Record<string, any> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) filtered[k] = val;
        }

        // Re-resolve community name if communityId changed
        if (updates.communityId) {
            const community = await ctx.db.get(updates.communityId);
            filtered.communityName = community?.name;
            if (community?.builderId) {
                filtered.builderId = community.builderId;
                const builder = await ctx.db.get(community.builderId);
                filtered.builderName = builder?.name;
            }
        }

        await ctx.db.patch(id, filtered);
        return { success: true };
    },
});

export const remove = mutation({
    args: { id: v.id("workLogs") },
    handler: async (ctx, args) => {
        const existing = await ctx.db.get(args.id);
        if (!existing) throw new Error("Work log not found");
        if (existing.status === "VERIFIED") {
            throw new Error("Cannot delete a verified work log");
        }
        await ctx.db.delete(args.id);
        return { success: true };
    },
});

// Batch-set billing status for all Blue Book entries in a community
export const setCommunityBillingStatus = mutation({
    args: {
        communityId: v.id("communities"),
        builderId: v.optional(v.id("builders")),
        billingStatus: v.string(),
    },
    handler: async (ctx, args) => {
        const valid = ["invoiced_paid", "admin_paid", "none"];
        if (!valid.includes(args.billingStatus)) {
            throw new Error(`Invalid billingStatus. Must be one of: ${valid.join(", ")}`);
        }

        // Get all Blue Book entries for this community (optionally scoped by builder)
        let entries;
        if (args.builderId) {
            entries = await ctx.db
                .query("blueBookEntries")
                .withIndex("by_builder_community", (q) =>
                    q.eq("builderId", args.builderId!).eq("communityId", args.communityId)
                )
                .take(5000);
        } else {
            entries = await ctx.db
                .query("blueBookEntries")
                .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
                .take(5000);
        }

        // Filter out deleted
        entries = entries.filter((e) => e.status !== "DELETED");

        // Batch update
        const now = Date.now();
        await Promise.all(
            entries.map((e) =>
                ctx.db.patch(e._id, { billingStatus: args.billingStatus, updatedAt: now })
            )
        );

        return { updated: entries.length };
    },
});
