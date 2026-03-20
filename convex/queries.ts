import { query } from "./_generated/server";
import { v } from "convex/values";

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
    handler: async (ctx) => {
        const plans = await ctx.db.query("modelPlans").collect();
        return plans.filter((p) => p.active !== false);
    },
});

// ── Communities by builder ────────────────────────────────────────────

export const getCommunitiesByBuilder = query({
    args: { builderId: v.id("builders") },
    handler: async (ctx, args) => {
        const communities = await ctx.db
            .query("communities")
            .withIndex("by_builder", (q) => q.eq("builderId", args.builderId))
            .collect();
        return communities.filter((c) => c.active !== false);
    },
});

// Get all jobs for the schedule view (real-time)
export const getScheduleJobs = query({
    args: {
        startDate: v.string(),
        endDate: v.string()
    },
    handler: async (ctx, args) => {
        // Get job request services within date range
        const jobServices = await ctx.db
            .query("jobRequestServices")
            .filter((q) =>
                q.and(
                    q.gte(q.field("scheduledDate"), args.startDate),
                    q.lte(q.field("scheduledDate"), args.endDate)
                )
            )
            .collect();

        // Enrich with job request details
        const enrichedJobs = await Promise.all(
            jobServices.map(async (jrs) => {
                const jobRequest = await ctx.db.get(jrs.jobRequestId);
                let communityName = null;
                let builderName = null;

                if (jobRequest?.communityId) {
                    const community = await ctx.db.get(jobRequest.communityId);
                    communityName = community?.name ?? null;
                }
                if (jobRequest?.builderId) {
                    const builder = await ctx.db.get(jobRequest.builderId);
                    builderName = builder?.name ?? null;
                }

                return {
                    id: jrs._id,
                    startDate: jrs.scheduledDate,
                    builderName,
                    communityName,
                    lot: jobRequest?.lot ?? null,
                    serviceName: jrs.serviceName,
                    walkTime: jrs.walkTime,
                    status: jrs.status,
                    assignedForemanName: jrs.assignedForemanName,
                    assignedCrewName: jrs.assignedCrewName,
                    rescheduledDate: jrs.rescheduledDate,
                };
            })
        );

        return enrichedJobs;
    },
});

// Get all dispatch batches (real-time)
export const getDispatchBatches = query({
    handler: async (ctx) => {
        const batches = await ctx.db.query("dispatchBatches").collect();

        // Enrich with job count
        const enrichedBatches = await Promise.all(
            batches.map(async (batch) => {
                const assignments = await ctx.db
                    .query("assignments")
                    .withIndex("by_batch", (q) => q.eq("dispatchBatchId", batch._id))
                    .collect();

                return {
                    id: batch._id,
                    serviceDate: batch.serviceDate,
                    status: batch.status,
                    crewName: batch.crewName ?? "Unassigned Crew",
                    foremanName: batch.foremanName ?? "Unassigned",
                    jobCount: assignments.length,
                };
            })
        );

        return enrichedBatches;
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

        const jobs = await Promise.all(
            assignments.map(async (assignment) => {
                const jrs = await ctx.db.get(assignment.jobRequestServiceId);
                if (!jrs) return null;

                const jobRequest = await ctx.db.get(jrs.jobRequestId);
                let communityName = null;
                let builderName = null;

                if (jobRequest?.communityId) {
                    const community = await ctx.db.get(jobRequest.communityId);
                    communityName = community?.name ?? null;
                }
                if (jobRequest?.builderId) {
                    const builder = await ctx.db.get(jobRequest.builderId);
                    builderName = builder?.name ?? null;
                }

                return {
                    id: jrs._id,
                    assignmentId: assignment._id,
                    communityName,
                    builderName,
                    lot: jobRequest?.lot ?? null,
                    address: jobRequest?.address ?? null,
                    serviceName: jrs.serviceName,
                    walkTime: jrs.walkTime,
                    dueDate: jrs.scheduledDate ?? null,
                    status: assignment.status,
                    assignedForeman: batch.foremanName ?? null,
                };
            })
        );

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
    handler: async (ctx) => {
        const users = await ctx.db.query("users").collect();

        const enrichedUsers = await Promise.all(
            users.map(async (user) => {
                const memberships = await ctx.db
                    .query("orgMembers")
                    .withIndex("by_user", (q) => q.eq("userId", user._id))
                    .collect();

                const membershipDetails = await Promise.all(
                    memberships.map(async (m) => {
                        const org = await ctx.db.get(m.orgId);
                        return {
                            orgId: m.orgId,
                            orgName: org?.name ?? "Unknown",
                            role: m.role,
                        };
                    })
                );

                return {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    systemRole: user.role,
                    memberships: membershipDetails,
                };
            })
        );

        return enrichedUsers;
    },
});

// Get all organizations
export const getOrgs = query({
    handler: async (ctx) => {
        return await ctx.db.query("orgs").collect();
    },
});

// Get all builders
export const getBuilders = query({
    handler: async (ctx) => {
        return await ctx.db.query("builders").collect();
    },
});

// Get all communities
export const getCommunities = query({
    handler: async (ctx) => {
        return await ctx.db.query("communities").collect();
    },
});

// Get all services
export const getServices = query({
    handler: async (ctx) => {
        return await ctx.db.query("services").collect();
    },
});

// Get crews
export const getCrews = query({
    handler: async (ctx) => {
        const crews = await ctx.db.query("crews").collect();

        const enrichedCrews = await Promise.all(
            crews.map(async (crew) => {
                let foremanName = null;
                if (crew.foremanId) {
                    const foreman = await ctx.db.get(crew.foremanId);
                    foremanName = foreman?.name ?? null;
                }
                return {
                    ...crew,
                    id: crew._id,
                    foremanName,
                };
            })
        );

        return enrichedCrews;
    },
});
