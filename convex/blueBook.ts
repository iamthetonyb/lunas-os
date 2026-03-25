import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

export const list = query({
    args: {
        builderId: v.optional(v.id("builders")),
        status: v.optional(v.string()),
        invoiced: v.optional(v.boolean()),
        search: v.optional(v.string()),
        page: v.optional(v.number()),
        pageSize: v.optional(v.number()),
        sort: v.optional(v.string()),
        callerUserId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        // ── Permission scoping ──────────────────────────────────────────
        let callerName: string | null = null;
        if (args.callerUserId) {
            const caller = await ctx.db.get(args.callerUserId);
            if (caller) {
                const role = (caller.role ?? "").toUpperCase();
                if (role !== "ADMIN" && role !== "BACKOFFICE") {
                    callerName = caller.name ?? null;
                }
            }
        }

        // ── Index-first filtering ──────────────────────────────────────
        // Pick the most selective compound index based on supplied filters.
        let baseQuery;
        if (args.builderId && args.status) {
            baseQuery = ctx.db
                .query("blueBookEntries")
                .withIndex("by_builder_status", (q) =>
                    q.eq("builderId", args.builderId!).eq("status", args.status!)
                );
        } else if (args.builderId) {
            baseQuery = ctx.db
                .query("blueBookEntries")
                .withIndex("by_builder", (q) => q.eq("builderId", args.builderId!));
        } else if (args.status) {
            baseQuery = ctx.db
                .query("blueBookEntries")
                .withIndex("by_status", (q) => q.eq("status", args.status!));
        } else {
            baseQuery = ctx.db.query("blueBookEntries");
        }

        // Limit to prevent unbounded table scans — paginate server-side
        let entries = await baseQuery.take(10000);

        // ── Filter out soft-deleted entries ─────────────────────────────
        entries = entries.filter((e) => e.status !== 'DELETED');

        // ── Apply permission filter: non-admin/backoffice only see their own entries ──
        if (callerName) {
            const lowerCallerName = callerName.toLowerCase();
            entries = entries.filter((e) =>
                (e.assignedForemanName ?? "").toLowerCase() === lowerCallerName
            );
        }

        // ── In-memory filters (not indexable) ──────────────────────────
        if (args.invoiced === false) {
            entries = entries.filter((e) => !e.invoiceLineId);
        }

        if (args.search) {
            const term = args.search.toLowerCase();
            entries = entries.filter(
                (e) =>
                    (e.lot ?? "").toLowerCase().includes(term) ||
                    (e.poNumber ?? "").toLowerCase().includes(term) ||
                    (e.accountCategoryCode ?? "").toLowerCase().includes(term) ||
                    (e.accountCategoryName ?? "").toLowerCase().includes(term) ||
                    (e.checkNumber ?? "").toLowerCase().includes(term)
            );
        }

        // ── Sort ───────────────────────────────────────────────────────
        // Default: group by community, then sort by date earliest→latest,
        // preserving upload/insertion order within the same date (importOrder or createdAt).
        if (args.sort === "checkDate") {
            entries.sort((a, b) =>
                (a.checkDate ?? "").localeCompare(b.checkDate ?? "")
            );
        } else {
            entries.sort((a, b) => {
                const cmp = (a.communityId ?? "").localeCompare(
                    b.communityId ?? ""
                );
                if (cmp !== 0) return cmp;
                const dateCmp = (a.startDate ?? "").localeCompare(b.startDate ?? "");
                if (dateCmp !== 0) return dateCmp;
                // Same date → preserve upload order (importOrder or createdAt)
                const orderA = a.importOrder ?? a.createdAt;
                const orderB = b.importOrder ?? b.createdAt;
                return orderA - orderB;
            });
        }

        // ── Paginate ───────────────────────────────────────────────────
        const pageSize = args.pageSize ?? 500;
        const page = args.page ?? 1;
        const offset = (page - 1) * pageSize;
        const total = entries.length;
        const paginated = entries.slice(offset, offset + pageSize);

        // ── Enrich: use denormalized fields, batch-load only on miss ──
        // Collect unique IDs that need lookup (entries missing denormalized data).
        const builderIdsToLoad = new Set<string>();
        const communityIdsToLoad = new Set<string>();
        const serviceIdsToLoad = new Set<string>();
        const modelPlanIdsToLoad = new Set<string>();

        for (const e of paginated) {
            if (e.builderId && !e.builderName) builderIdsToLoad.add(e.builderId);
            if (e.communityId && !e.communityName) communityIdsToLoad.add(e.communityId);
            if (e.serviceId && !e.serviceName) serviceIdsToLoad.add(e.serviceId);
            if (e.modelPlanId && e.modelPlanCode == null) {
                modelPlanIdsToLoad.add(e.modelPlanId);
            }
        }

        // Batch-load all missing lookups in parallel (one db.get per unique ID, not per row).
        const builderMap = new Map<string, Doc<"builders">>();
        const communityMap = new Map<string, Doc<"communities">>();
        const serviceMap = new Map<string, Doc<"services">>();
        const modelPlanMap = new Map<string, Doc<"modelPlans">>();

        const builderIds = Array.from(builderIdsToLoad) as Id<"builders">[];
        const communityIds = Array.from(communityIdsToLoad) as Id<"communities">[];
        const serviceIds = Array.from(serviceIdsToLoad) as Id<"services">[];
        const modelPlanIds = Array.from(modelPlanIdsToLoad) as Id<"modelPlans">[];

        const [builderDocs, communityDocs, serviceDocs, modelPlanDocs] =
            await Promise.all([
                Promise.all(builderIds.map((id) => ctx.db.get(id))),
                Promise.all(communityIds.map((id) => ctx.db.get(id))),
                Promise.all(serviceIds.map((id) => ctx.db.get(id))),
                Promise.all(modelPlanIds.map((id) => ctx.db.get(id))),
            ]);

        builderIds.forEach((id, i) => {
            if (builderDocs[i]) builderMap.set(id, builderDocs[i]!);
        });
        communityIds.forEach((id, i) => {
            if (communityDocs[i]) communityMap.set(id, communityDocs[i]!);
        });
        serviceIds.forEach((id, i) => {
            if (serviceDocs[i]) serviceMap.set(id, serviceDocs[i]!);
        });
        modelPlanIds.forEach((id, i) => {
            if (modelPlanDocs[i]) modelPlanMap.set(id, modelPlanDocs[i]!);
        });

        const enriched = paginated.map((e) => {
            // Prefer denormalized field; fall back to batch-loaded record.
            const builderName =
                e.builderName ??
                (e.builderId ? (builderMap.get(e.builderId)?.name ?? null) : null);
            const communityName =
                e.communityName ??
                (e.communityId ? (communityMap.get(e.communityId)?.name ?? null) : null);
            const serviceName =
                e.serviceName ??
                (e.serviceId ? (serviceMap.get(e.serviceId)?.name ?? null) : null);
            const modelPlanCode =
                e.modelPlanCode ??
                (e.modelPlanId ? (modelPlanMap.get(e.modelPlanId)?.code ?? null) : null);
            const modelPlanSqft =
                e.modelPlanSqft ??
                (e.modelPlanId ? (modelPlanMap.get(e.modelPlanId)?.sqft ?? null) : null);

            return {
                ...e,
                id: e._id,
                builderName,
                communityName,
                serviceName,
                modelPlanCode,
                modelPlanSqft,
            };
        });

        return {
            entries: enriched,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    },
});

// ── Mutations ──────────────────────────────────────────────────────────

export const create = mutation({
    args: {
        builderId: v.id("builders"),
        communityId: v.optional(v.id("communities")),
        serviceId: v.optional(v.union(v.id("services"), v.null())),
        modelPlanId: v.optional(v.union(v.id("modelPlans"), v.null())),
        lot: v.optional(v.string()),
        startDate: v.optional(v.string()),
        status: v.optional(v.string()),
        invoiceNumber: v.optional(v.string()),
        amount: v.optional(v.union(v.number(), v.null())),
        accountCategoryName: v.optional(v.string()),
        accountCategoryCode: v.optional(v.string()),
        checkNumber: v.optional(v.string()),
        checkDate: v.optional(v.string()),
        billingStatus: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // ── Input validation ─────────────────────────────────────────
        if (args.amount !== undefined && args.amount !== null && isNaN(args.amount)) {
            throw new Error("Amount must be a valid number");
        }
        if (args.startDate && !/^\d{4}-\d{2}-\d{2}/.test(args.startDate)) {
            throw new Error("startDate must be ISO-8601 format (YYYY-MM-DD)");
        }
        if (args.checkDate && !/^\d{4}-\d{2}-\d{2}/.test(args.checkDate)) {
            throw new Error("checkDate must be ISO-8601 format (YYYY-MM-DD)");
        }
        const validStatuses = ["PENDING", "SCHEDULED", "DISPATCHED", "COMPLETE"];
        if (args.status && !validStatuses.includes(args.status)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
        }
        const validBillingStatuses = ["invoiced_paid", "admin_paid", "none"];
        if (args.billingStatus && !validBillingStatuses.includes(args.billingStatus)) {
            throw new Error(`Invalid billingStatus. Must be one of: ${validBillingStatuses.join(", ")}`);
        }

        const now = Date.now();

        // Resolve denormalized names in parallel.
        const [builder, community, service, modelPlan] = await Promise.all([
            ctx.db.get(args.builderId),
            args.communityId ? ctx.db.get(args.communityId) : null,
            args.serviceId ? ctx.db.get(args.serviceId) : null,
            args.modelPlanId ? ctx.db.get(args.modelPlanId) : null,
        ]);

        const startDateNum = args.startDate
            ? new Date(args.startDate).getTime() || undefined
            : undefined;

        const id = await ctx.db.insert("blueBookEntries", {
            builderId: args.builderId,
            communityId: args.communityId ?? undefined,
            serviceId: args.serviceId ?? undefined,
            modelPlanId: args.modelPlanId ?? undefined,
            lot: args.lot,
            startDate: args.startDate,
            startDateNum,
            status: args.status ?? "PENDING",
            invoiceNumber: args.invoiceNumber,
            amount: args.amount != null ? String(args.amount) : undefined,
            accountCategoryName: args.accountCategoryName,
            accountCategoryCode: args.accountCategoryCode,
            checkNumber: args.checkNumber,
            checkDate: args.checkDate,
            // Denormalized fields
            builderName: builder?.name,
            communityName: community?.name,
            serviceName: service?.name,
            modelPlanCode: modelPlan?.code,
            modelPlanSqft: modelPlan?.sqft,
            billingStatus: args.billingStatus ?? "none",
            source: "manual",
            createdAt: now,
            updatedAt: now,
        });
        return { id };
    },
});

export const update = mutation({
    args: {
        id: v.id("blueBookEntries"),
        status: v.optional(v.string()),
        amount: v.optional(v.string()),
        checkNumber: v.optional(v.string()),
        checkDate: v.optional(v.string()),
        checkTotal: v.optional(v.string()),
        isAch: v.optional(v.boolean()),
        assignedForemanName: v.optional(v.string()),
        crewName: v.optional(v.string()),
        lot: v.optional(v.string()),
        startDate: v.optional(v.string()),
        invoiceNumber: v.optional(v.string()),
        accountCategoryName: v.optional(v.string()),
        accountCategoryCode: v.optional(v.string()),
        builderId: v.optional(v.id("builders")),
        communityId: v.optional(v.union(v.id("communities"), v.null())),
        serviceId: v.optional(v.union(v.id("services"), v.null())),
        modelPlanId: v.optional(v.union(v.id("modelPlans"), v.null())),
        billingStatus: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;

        const filtered: Record<string, any> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) filtered[k] = val;
        }

        // If a FK changed, refresh the corresponding denormalized field.
        const lookups: Array<Promise<void>> = [];

        if (updates.builderId !== undefined) {
            lookups.push(
                ctx.db.get(updates.builderId).then((b) => {
                    filtered.builderName = b?.name ?? null;
                })
            );
        }
        if (updates.communityId !== undefined) {
            lookups.push(
                updates.communityId
                    ? ctx.db.get(updates.communityId).then((c) => {
                          filtered.communityName = c?.name ?? null;
                      })
                    : Promise.resolve().then(() => {
                          filtered.communityName = null;
                      })
            );
        }
        if (updates.serviceId !== undefined) {
            lookups.push(
                updates.serviceId
                    ? ctx.db.get(updates.serviceId).then((s) => {
                          filtered.serviceName = s?.name ?? null;
                      })
                    : Promise.resolve().then(() => {
                          filtered.serviceName = null;
                      })
            );
        }
        if (updates.modelPlanId !== undefined) {
            lookups.push(
                updates.modelPlanId
                    ? ctx.db.get(updates.modelPlanId).then((mp) => {
                          filtered.modelPlanCode = mp?.code ?? null;
                          filtered.modelPlanSqft = mp?.sqft ?? null;
                      })
                    : Promise.resolve().then(() => {
                          filtered.modelPlanCode = null;
                          filtered.modelPlanSqft = null;
                      })
            );
        }

        // If startDate changed, recompute startDateNum.
        if (updates.startDate !== undefined) {
            filtered.startDateNum = updates.startDate
                ? new Date(updates.startDate).getTime() || undefined
                : undefined;
        }

        await Promise.all(lookups);
        await ctx.db.patch(id, filtered);
        return { success: true };
    },
});

export const remove = mutation({
    args: { id: v.id("blueBookEntries") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return { success: true };
    },
});
