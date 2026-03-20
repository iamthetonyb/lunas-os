import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";

// --- Batch-load helpers ---

async function batchLoadBuilders(
  ctx: any,
  requests: Doc<"jobRequests">[]
): Promise<Map<Id<"builders">, Doc<"builders">>> {
  const ids = [...new Set(requests.map((r) => r.builderId).filter(Boolean))] as Id<"builders">[];
  const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return new Map(
    docs.filter(Boolean).map((d: Doc<"builders">) => [d._id, d])
  );
}

async function batchLoadCommunities(
  ctx: any,
  requests: Doc<"jobRequests">[]
): Promise<Map<Id<"communities">, Doc<"communities">>> {
  const ids = [...new Set(requests.map((r) => r.communityId).filter(Boolean))] as Id<"communities">[];
  const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return new Map(
    docs.filter(Boolean).map((d: Doc<"communities">) => [d._id, d])
  );
}

async function batchLoadModelPlans(
  ctx: any,
  requests: Doc<"jobRequests">[]
): Promise<Map<Id<"modelPlans">, Doc<"modelPlans">>> {
  const ids = [...new Set(requests.map((r) => r.modelPlanId).filter(Boolean))] as Id<"modelPlans">[];
  const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return new Map(
    docs.filter(Boolean).map((d: Doc<"modelPlans">) => [d._id, d])
  );
}

async function batchLoadServices(
  ctx: any,
  requests: Doc<"jobRequests">[]
): Promise<Map<Id<"jobRequests">, Doc<"jobRequestServices">[]>> {
  const allServices = await Promise.all(
    requests.map((jr) =>
      ctx.db
        .query("jobRequestServices")
        .withIndex("by_jobRequest", (q: any) => q.eq("jobRequestId", jr._id))
        .collect()
    )
  );
  const map = new Map<Id<"jobRequests">, Doc<"jobRequestServices">[]>();
  requests.forEach((jr, i) => {
    map.set(jr._id, allServices[i]);
  });
  return map;
}

function enrichRequests(
  requests: Doc<"jobRequests">[],
  builderMap: Map<Id<"builders">, Doc<"builders">>,
  communityMap: Map<Id<"communities">, Doc<"communities">>,
  modelPlanMap: Map<Id<"modelPlans">, Doc<"modelPlans">>,
  servicesMap: Map<Id<"jobRequests">, Doc<"jobRequestServices">[]>
) {
  return requests.map((jr) => {
    const services = servicesMap.get(jr._id) ?? [];
    return {
      ...jr,
      id: jr._id,
      builderName: jr.builderId ? (builderMap.get(jr.builderId)?.name ?? null) : null,
      communityName: jr.communityId ? (communityMap.get(jr.communityId)?.name ?? null) : null,
      modelPlanName: jr.modelPlanId ? (modelPlanMap.get(jr.modelPlanId)?.name ?? null) : null,
      services: services.map((s) => ({ ...s, id: s._id })),
    };
  });
}

// --- Queries ---

export const list = query({
  args: {
    isExtraWork: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Use by_createdAt index for ordered retrieval instead of unindexed .order("desc").collect()
    let requests = await ctx.db
      .query("jobRequests")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    if (args.isExtraWork !== undefined) {
      requests = requests.filter((r) => r.isExtraWork === args.isExtraWork);
    }

    const limited = requests.slice(0, args.limit ?? 100);

    // Batch-load all related entities in parallel — one pass per entity type
    const [builderMap, communityMap, modelPlanMap, servicesMap] = await Promise.all([
      batchLoadBuilders(ctx, limited),
      batchLoadCommunities(ctx, limited),
      batchLoadModelPlans(ctx, limited),
      batchLoadServices(ctx, limited),
    ]);

    return enrichRequests(limited, builderMap, communityMap, modelPlanMap, servicesMap);
  },
});

export const getById = query({
  args: { id: v.id("jobRequests") },
  handler: async (ctx, args) => {
    const jr = await ctx.db.get(args.id);
    if (!jr) return null;

    // For a single record the N+1 is just 3 parallel gets — still better than sequential
    const [builder, community, modelPlan, services] = await Promise.all([
      jr.builderId ? ctx.db.get(jr.builderId) : null,
      jr.communityId ? ctx.db.get(jr.communityId) : null,
      jr.modelPlanId ? ctx.db.get(jr.modelPlanId) : null,
      ctx.db
        .query("jobRequestServices")
        .withIndex("by_jobRequest", (q) => q.eq("jobRequestId", jr._id))
        .collect(),
    ]);

    return {
      ...jr,
      id: jr._id,
      builderName: builder?.name ?? null,
      communityName: community?.name ?? null,
      modelPlanName: modelPlan?.name ?? null,
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

    // Use by_createdAt index for ordered retrieval
    let requests = await ctx.db
      .query("jobRequests")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    if (args.userId) {
      requests = requests.filter((r) => r.createdById === args.userId);
    }

    const total = requests.length;
    const paginated = requests.slice(offset, offset + limit);

    // Batch-load all related entities in parallel
    const [builderMap, communityMap, modelPlanMap, servicesMap] = await Promise.all([
      batchLoadBuilders(ctx, paginated),
      batchLoadCommunities(ctx, paginated),
      batchLoadModelPlans(ctx, paginated),
      batchLoadServices(ctx, paginated),
    ]);

    return {
      intakes: enrichRequests(paginated, builderMap, communityMap, modelPlanMap, servicesMap),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },
});

// --- Mutations (unchanged) ---

export const update = mutation({
  args: {
    id: v.id("jobRequests"),
    amount: v.optional(v.string()),
    status: v.optional(v.string()),
    isExtraWork: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    lot: v.optional(v.string()),
    address: v.optional(v.string()),
    poNumber: v.optional(v.string()),
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
