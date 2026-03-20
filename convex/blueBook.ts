import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: {
        builderId: v.optional(v.id("builders")),
        status: v.optional(v.string()),
        invoiced: v.optional(v.boolean()),
        search: v.optional(v.string()),
        page: v.optional(v.number()),
        pageSize: v.optional(v.number()),
        sort: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let entries = await ctx.db.query("blueBookEntries").collect();

        // Filter by builder
        if (args.builderId) {
            entries = entries.filter((e) => e.builderId === args.builderId);
        }

        // Filter by status
        if (args.status) {
            entries = entries.filter((e) => e.status === args.status);
        }

        // Filter by invoiced state
        if (args.invoiced === false) {
            entries = entries.filter((e) => !e.invoiceLineId);
        }

        // Search filter
        if (args.search) {
            const term = args.search.toLowerCase();
            entries = entries.filter((e) =>
                (e.lot ?? '').toLowerCase().includes(term) ||
                (e.poNumber ?? '').toLowerCase().includes(term) ||
                (e.accountCategoryCode ?? '').toLowerCase().includes(term) ||
                (e.accountCategoryName ?? '').toLowerCase().includes(term) ||
                (e.checkNumber ?? '').toLowerCase().includes(term)
            );
        }

        // Sort
        if (args.sort === 'checkDate') {
            entries.sort((a, b) => (a.checkDate ?? '').localeCompare(b.checkDate ?? ''));
        } else {
            // Default: group by community, then startDate
            entries.sort((a, b) => {
                const cmp = (a.communityId ?? '').localeCompare(b.communityId ?? '');
                if (cmp !== 0) return cmp;
                return (a.startDate ?? '').localeCompare(b.startDate ?? '');
            });
        }

        // Paginate
        const pageSize = args.pageSize ?? 500;
        const page = args.page ?? 1;
        const offset = (page - 1) * pageSize;
        const total = entries.length;
        const paginated = entries.slice(offset, offset + pageSize);

        // Enrich with builder/community names
        const enriched = await Promise.all(
            paginated.map(async (e) => {
                let builderName = null;
                let communityName = null;
                let serviceName = null;

                if (e.builderId) {
                    const b = await ctx.db.get(e.builderId);
                    builderName = b?.name ?? null;
                }
                if (e.communityId) {
                    const c = await ctx.db.get(e.communityId);
                    communityName = c?.name ?? null;
                }
                if (e.serviceId) {
                    const s = await ctx.db.get(e.serviceId);
                    serviceName = s?.name ?? null;
                }

                let modelPlanCode: string | null = null;
                let modelPlanSqft: string | null = null;
                if (e.modelPlanId) {
                    const mp = await ctx.db.get(e.modelPlanId);
                    modelPlanCode = mp?.code ?? null;
                    modelPlanSqft = mp?.sqft ?? null;
                }

                return {
                    ...e,
                    id: e._id,
                    builderName,
                    communityName,
                    serviceName,
                    modelPlanCode,
                    modelPlanSqft,
                };
            })
        );

        return { entries: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
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
        modelPlanId: v.optional(v.union(v.id("modelPlans"), v.null())),
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

export const create = mutation({
    args: {
        builderId: v.id("builders"),
        communityId: v.optional(v.id("communities")),
        serviceId: v.optional(v.union(v.id("services"), v.null())),
        lot: v.optional(v.string()),
        startDate: v.optional(v.string()),
        status: v.optional(v.string()),
        invoiceNumber: v.optional(v.string()),
        amount: v.optional(v.union(v.number(), v.null())),
        accountCategoryName: v.optional(v.string()),
        accountCategoryCode: v.optional(v.string()),
        checkNumber: v.optional(v.string()),
        checkDate: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const id = await ctx.db.insert("blueBookEntries", {
            builderId: args.builderId,
            communityId: args.communityId ?? undefined,
            serviceId: args.serviceId ?? undefined,
            lot: args.lot,
            startDate: args.startDate,
            status: args.status ?? "PENDING",
            invoiceNumber: args.invoiceNumber,
            amount: args.amount != null ? String(args.amount) : undefined,
            accountCategoryName: args.accountCategoryName,
            accountCategoryCode: args.accountCategoryCode,
            checkNumber: args.checkNumber,
            checkDate: args.checkDate,
            source: "manual",
            createdAt: now,
            updatedAt: now,
        });
        return { id };
    },
});

export const remove = mutation({
    args: { id: v.id("blueBookEntries") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return { success: true };
    },
});
