import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: {
        isExtraWork: v.optional(v.boolean()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        let requests = await ctx.db.query("jobRequests").order("desc").collect();

        if (args.isExtraWork !== undefined) {
            requests = requests.filter((r) => r.isExtraWork === args.isExtraWork);
        }

        const limited = requests.slice(0, args.limit ?? 100);

        const enriched = await Promise.all(
            limited.map(async (jr) => {
                let builderName = null;
                let communityName = null;
                let modelPlanName = null;

                if (jr.builderId) {
                    const b = await ctx.db.get(jr.builderId);
                    builderName = b?.name ?? null;
                }
                if (jr.communityId) {
                    const c = await ctx.db.get(jr.communityId);
                    communityName = c?.name ?? null;
                }
                if (jr.modelPlanId) {
                    const mp = await ctx.db.get(jr.modelPlanId);
                    modelPlanName = mp?.name ?? null;
                }

                // Get services for this job request
                const services = await ctx.db
                    .query("jobRequestServices")
                    .withIndex("by_jobRequest", (q) => q.eq("jobRequestId", jr._id))
                    .collect();

                return {
                    ...jr,
                    id: jr._id,
                    builderName,
                    communityName,
                    modelPlanName,
                    services: services.map((s) => ({
                        ...s,
                        id: s._id,
                    })),
                };
            })
        );

        return enriched;
    },
});

export const getById = query({
    args: { id: v.id("jobRequests") },
    handler: async (ctx, args) => {
        const jr = await ctx.db.get(args.id);
        if (!jr) return null;

        let builderName = null;
        let communityName = null;
        let modelPlanName = null;

        if (jr.builderId) {
            const b = await ctx.db.get(jr.builderId);
            builderName = b?.name ?? null;
        }
        if (jr.communityId) {
            const c = await ctx.db.get(jr.communityId);
            communityName = c?.name ?? null;
        }
        if (jr.modelPlanId) {
            const mp = await ctx.db.get(jr.modelPlanId);
            modelPlanName = mp?.name ?? null;
        }

        const services = await ctx.db
            .query("jobRequestServices")
            .withIndex("by_jobRequest", (q) => q.eq("jobRequestId", jr._id))
            .collect();

        return {
            ...jr,
            id: jr._id,
            builderName,
            communityName,
            modelPlanName,
            services: services.map((s) => ({ ...s, id: s._id })),
        };
    },
});

export const getRecent = query({
    args: {
        userId: v.optional(v.id("users")),
        limit: v.optional(v.number()),
        page: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 10;
        const page = args.page ?? 1;
        const offset = (page - 1) * limit;

        let requests = await ctx.db.query("jobRequests").order("desc").collect();

        if (args.userId) {
            requests = requests.filter((r) => r.createdById === args.userId);
        }

        const total = requests.length;
        const paginated = requests.slice(offset, offset + limit);

        const enriched = await Promise.all(
            paginated.map(async (jr) => {
                let builderName = null;
                let communityName = null;
                let modelPlanName = null;

                if (jr.builderId) {
                    const b = await ctx.db.get(jr.builderId);
                    builderName = b?.name ?? null;
                }
                if (jr.communityId) {
                    const c = await ctx.db.get(jr.communityId);
                    communityName = c?.name ?? null;
                }
                if (jr.modelPlanId) {
                    const mp = await ctx.db.get(jr.modelPlanId);
                    modelPlanName = mp?.name ?? null;
                }

                const services = await ctx.db
                    .query("jobRequestServices")
                    .withIndex("by_jobRequest", (q) => q.eq("jobRequestId", jr._id))
                    .collect();

                return {
                    ...jr,
                    id: jr._id,
                    builderName,
                    communityName,
                    modelPlanName,
                    services: services.map((s) => ({ ...s, id: s._id })),
                };
            })
        );

        return {
            intakes: enriched,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    },
});

export const update = mutation({
    args: {
        id: v.id("jobRequests"),
        amount: v.optional(v.string()),
        status: v.optional(v.string()),
        isExtraWork: v.optional(v.boolean()),
        notes: v.optional(v.string()),
        dueDate: v.optional(v.string()),
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
    args: { id: v.id("jobRequests") },
    handler: async (ctx, args) => {
        // Delete associated services first
        const services = await ctx.db
            .query("jobRequestServices")
            .withIndex("by_jobRequest", (q) => q.eq("jobRequestId", args.id))
            .collect();
        for (const svc of services) {
            await ctx.db.delete(svc._id);
        }
        await ctx.db.delete(args.id);
        return { success: true };
    },
});
