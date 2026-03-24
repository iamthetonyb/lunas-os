import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

// ── Auth Queries ──────────────────────────────────────────────────────

export const getUserByEmail = query({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .first();
        if (!user) return null;

        const membership = await ctx.db
            .query("orgMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .first();

        return {
            _id: user._id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
            passwordHash: user.passwordHash,
            preferredLang: user.preferredLang,
            preferredContactMethod: user.preferredContactMethod,
            orgId: membership?.orgId ?? null,
            orgRole: membership?.role ?? null,
        };
    },
});

export const getUserById = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) return null;

        const membership = await ctx.db
            .query("orgMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .first();

        return {
            _id: user._id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
            preferredLang: user.preferredLang,
            preferredContactMethod: user.preferredContactMethod,
            orgId: membership?.orgId ?? null,
            orgRole: membership?.role ?? null,
        };
    },
});

// ── Model Plans ───────────────────────────────────────────────────────

export const getModelPlans = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const plans = await ctx.db
            .query("modelPlans")
            .collect();
        const active = plans.filter((p) => p.active !== false);
        return args.limit ? active.slice(0, args.limit) : active;
    },
});

// ── Communities by builder ────────────────────────────────────────────

export const getCommunitiesByBuilder = query({
    args: {
        builderId: v.id("builders"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const communities = await ctx.db
            .query("communities")
            .withIndex("by_builder", (q) => q.eq("builderId", args.builderId))
            .collect();
        const active = communities.filter((c) => c.active !== false);
        return args.limit ? active.slice(0, args.limit) : active;
    },
});

// Get all jobs for the schedule view (real-time)
export const getScheduleJobs = query({
    args: {
        startDate: v.string(),
        endDate: v.string(),
    },
    handler: async (ctx, args) => {
        // Single-pass: fetch all jobRequestServices and filter by effective date.
        // effectiveDate = rescheduledDate (if set) ?? scheduledDate
        // This prevents showing a job on its original date after rescheduling.
        const allJrs = await ctx.db.query("jobRequestServices").collect();

        const jobServices = allJrs.filter((jrs) => {
            if (jrs.status === "COMPLETE") return false; // skip completed unless needed
            const effectiveDate = jrs.rescheduledDate ?? jrs.scheduledDate ?? "";
            return effectiveDate >= args.startDate && effectiveDate <= args.endDate;
        });

        // BATCH-LOAD: Collect all unique IDs, fetch once, build maps
        const jobRequestIds = [...new Set(jobServices.map((jrs) => jrs.jobRequestId))];
        const jobRequests = await Promise.all(jobRequestIds.map((id) => ctx.db.get(id)));
        const jrMap = new Map(jobRequests.filter(Boolean).map((jr) => [jr!._id, jr!]));

        const communityIds = [...new Set(
            jobRequests.filter(Boolean).map((jr) => jr!.communityId).filter(Boolean)
        )] as string[];
        const builderIds = [...new Set(
            jobRequests.filter(Boolean).map((jr) => jr!.builderId).filter(Boolean)
        )] as string[];

        const [communities, builders] = await Promise.all([
            Promise.all(communityIds.map((id) => ctx.db.get(id as Id<"communities">))),
            Promise.all(builderIds.map((id) => ctx.db.get(id as Id<"builders">))),
        ]);
        const communityMap = new Map<string, Doc<"communities">>(
            communities.filter(Boolean).map((c) => [c!._id, c!])
        );
        const builderMap = new Map<string, Doc<"builders">>(
            builders.filter(Boolean).map((b) => [b!._id, b!])
        );

        // O(1) lookups
        return jobServices.map((jrs) => {
            const jobRequest = jrMap.get(jrs.jobRequestId);
            const communityName = jobRequest?.communityId
                ? communityMap.get(jobRequest.communityId as string)?.name ?? null
                : null;
            const builderName = jobRequest?.builderId
                ? builderMap.get(jobRequest.builderId as string)?.name ?? null
                : null;

            const effectiveDate = jrs.rescheduledDate ?? jrs.scheduledDate;
            const wasRescheduled = !!jrs.rescheduledDate && jrs.rescheduledDate !== jrs.scheduledDate;

            return {
                id: jrs._id,
                jobRequestId: jrs.jobRequestId,
                startDate: effectiveDate,
                originalStartDate: wasRescheduled ? jrs.scheduledDate : null,
                builderName,
                communityName,
                lot: jobRequest?.lot ?? null,
                serviceName: jrs.serviceName,
                walkTime: jrs.walkTime,
                status: jrs.status,
                assignedForemanName: jrs.assignedForemanName,
                assignedCrewName: jrs.assignedCrewName,
                rescheduledDate: jrs.rescheduledDate,
                requestedBy: jobRequest?.requestedBy ?? null,
                isExtraWork: jobRequest?.isExtraWork ?? false,
            };
        });
    },
});

// Get all dispatch batches (real-time)
export const getDispatchBatches = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const batches = await ctx.db
            .query("dispatchBatches")
            .order("desc")
            .take(args.limit ?? 200);

        // BATCH-LOAD: Get all assignments for all batches in one pass
        const allAssignments = await Promise.all(
            batches.map((batch) =>
                ctx.db
                    .query("assignments")
                    .withIndex("by_batch", (q) => q.eq("dispatchBatchId", batch._id))
                    .collect()
            )
        );

        return batches.map((batch, i) => ({
            id: batch._id,
            serviceDate: batch.serviceDate,
            status: batch.status,
            crewName: batch.crewName ?? "Unassigned Crew",
            foremanName: batch.foremanName ?? "Unassigned",
            jobCount: allAssignments[i].length,
        }));
    },
});

// Get dispatch batch details by ID
export const getDispatchBatchById = query({
    args: { batchId: v.id("dispatchBatches") },
    handler: async (ctx, args) => {
        const batch = await ctx.db.get(args.batchId);
        if (!batch) return null;

        const assignments = await ctx.db
            .query("assignments")
            .withIndex("by_batch", (q) => q.eq("dispatchBatchId", args.batchId))
            .collect();

        // BATCH-LOAD: Fetch all JRS, then all JRs, then communities/builders
        const jrsIds = assignments.map((a) => a.jobRequestServiceId);
        const jrsList = await Promise.all(jrsIds.map((id) => ctx.db.get(id)));
        const jrsMap = new Map(jrsList.filter(Boolean).map((j) => [j!._id, j!]));

        const jrIds = [...new Set(jrsList.filter(Boolean).map((j) => j!.jobRequestId))];
        const jrList = await Promise.all(jrIds.map((id) => ctx.db.get(id)));
        const jrMap = new Map(jrList.filter(Boolean).map((j) => [j!._id, j!]));

        const communityIds = [...new Set(jrList.filter(Boolean).map((j) => j!.communityId).filter(Boolean))];
        const builderIds = [...new Set(jrList.filter(Boolean).map((j) => j!.builderId).filter(Boolean))];
        const [communities, builders] = await Promise.all([
            Promise.all(communityIds.map((id) => ctx.db.get(id as Id<"communities">))),
            Promise.all(builderIds.map((id) => ctx.db.get(id as Id<"builders">))),
        ]);
        const communityMap = new Map<string, Doc<"communities">>(
            communities.filter(Boolean).map((c) => [c!._id, c!])
        );
        const builderMap = new Map<string, Doc<"builders">>(
            builders.filter(Boolean).map((b) => [b!._id, b!])
        );

        const jobs = assignments.map((assignment) => {
            const jrs = jrsMap.get(assignment.jobRequestServiceId);
            if (!jrs) return null;
            const jobRequest = jrMap.get(jrs.jobRequestId);

            return {
                id: jrs._id,
                assignmentId: assignment._id,
                communityName: jobRequest?.communityId
                    ? communityMap.get(jobRequest.communityId as string)?.name ?? null
                    : null,
                builderName: jobRequest?.builderId
                    ? builderMap.get(jobRequest.builderId as string)?.name ?? null
                    : null,
                lot: jobRequest?.lot ?? null,
                address: jobRequest?.address ?? null,
                serviceName: jrs.serviceName,
                walkTime: jrs.walkTime,
                dueDate: jrs.scheduledDate ?? null,
                status: assignment.status,
                assignedForeman: batch.foremanName ?? null,
            };
        });

        return {
            id: batch._id,
            serviceDate: batch.serviceDate,
            status: batch.status,
            crewName: batch.crewName,
            foremanName: batch.foremanName,
            notes: batch.notes,
            jobs: jobs.filter(Boolean),
        };
    },
});

// Get all users (real-time)
export const getUsers = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const users = await ctx.db.query("users").take(args.limit ?? 500);

        // BATCH-LOAD: Get all memberships for all users, then all orgs
        const allMemberships = await Promise.all(
            users.map((user) =>
                ctx.db
                    .query("orgMembers")
                    .withIndex("by_user", (q) => q.eq("userId", user._id))
                    .collect()
            )
        );

        const allOrgIds = [...new Set(allMemberships.flat().map((m) => m.orgId))];
        const orgs = await Promise.all(allOrgIds.map((id) => ctx.db.get(id)));
        const orgMap = new Map(orgs.filter(Boolean).map((o) => [o!._id, o!]));

        return users.map((user, i) => ({
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            systemRole: user.role,
            memberships: allMemberships[i].map((m) => ({
                orgId: m.orgId,
                orgName: orgMap.get(m.orgId)?.name ?? "Unknown",
                role: m.role,
            })),
        }));
    },
});

// Get all organizations
export const getOrgs = query({
    handler: async (ctx) => {
        return await ctx.db.query("orgs").collect();
    },
});

// Get all active builders
export const getBuilders = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const builders = await ctx.db.query("builders").collect();
        const active = builders.filter((b) => b.active !== false);
        return args.limit ? active.slice(0, args.limit) : active;
    },
});

// Get all active communities
export const getCommunities = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const communities = await ctx.db.query("communities").collect();
        const active = communities.filter((c) => c.active !== false);
        // Deduplicate by normalized name — keep the one with a builderId, or the oldest
        const seen = new Map<string, typeof active[0]>();
        for (const c of active) {
            const key = (c.normalizedName ?? c.name.toLowerCase());
            const existing = seen.get(key);
            if (!existing) {
                seen.set(key, c);
            } else if (c.builderId && !existing.builderId) {
                // Prefer the one linked to a builder
                seen.set(key, c);
            }
        }
        const deduped = Array.from(seen.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
        return args.limit ? deduped.slice(0, args.limit) : deduped;
    },
});

// Get all active services
export const getServices = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const services = await ctx.db.query("services").collect();
        const active = services.filter((s) => s.active !== false);
        return args.limit ? active.slice(0, args.limit) : active;
    },
});

// Get crews
export const getCrews = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const crews = await ctx.db.query("crews").take(args.limit ?? 200);

        // BATCH-LOAD: Get all foreman users at once
        const foremanIds = [...new Set(crews.map((c) => c.foremanId).filter(Boolean))];
        const foremen = await Promise.all(foremanIds.map((id) => ctx.db.get(id!)));
        const foremanMap = new Map(foremen.filter(Boolean).map((f) => [f!._id, f!]));

        return crews.map((crew) => ({
            ...crew,
            id: crew._id,
            foremanName: crew.foremanId
                ? foremanMap.get(crew.foremanId)?.name ?? null
                : null,
        }));
    },
});

// ── Import History ───────────────────────────────────────────────────

export const getImportHistory = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("importHistory")
            .withIndex("by_createdAt")
            .order("desc")
            .take(args.limit ?? 20);
    },
});

export const getImportByHash = query({
    args: { fileHash: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("importHistory")
            .withIndex("by_fileHash", (q) => q.eq("fileHash", args.fileHash))
            .first();
    },
});

export const getImportById = query({
    args: { id: v.id("importHistory") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

export const getImportedEntities = query({
    args: { importId: v.id("importHistory") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("importedEntities")
            .withIndex("by_import", (q) => q.eq("importId", args.importId))
            .collect();
    },
});
