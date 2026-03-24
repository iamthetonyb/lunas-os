import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

export const getProfile = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) return null;
        return {
            id: user._id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
            preferredLang: user.preferredLang ?? 'EN',
            preferredContactMethod: user.preferredContactMethod ?? 'email',
        };
    },
});

export const updateProfile = mutation({
    args: {
        userId: v.id("users"),
        preferredLang: v.optional(v.string()),
        preferredContactMethod: v.optional(v.string()),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { userId, ...updates } = args;
        const filtered: Record<string, any> = { updatedAt: Date.now() };
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) filtered[k] = val;
        }
        await ctx.db.patch(userId, filtered);
        return { success: true };
    },
});

// FIX: was .collect() on entire users table + .find() in JS.
// Now uses by_name index for O(1) lookup.
export const getForemanContact = query({
    args: { name: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_name", (q) => q.eq("name", args.name))
            .first();
        if (!user) return null;
        return {
            name: user.name,
            email: user.email,
            phone: user.phone,
            preferredContactMethod: user.preferredContactMethod ?? 'email',
        };
    },
});

// FIX: was .collect() on entire dispatchBatches + N+1 gets per assignment.
// Now uses by_serviceDate index to filter server-side, then batch-loads
// all related entities (jrs, jr, community, builder) with deduped Maps
// for O(1) lookups instead of per-row fetches.
export const getMyAssignments = query({
    args: { userName: v.string() },
    handler: async (ctx, args) => {
        const today = new Date().toISOString().split('T')[0];
        const nameLower = args.userName.toLowerCase();

        // Use by_serviceDate index to only scan current/future batches.
        const batches = await ctx.db
            .query("dispatchBatches")
            .withIndex("by_serviceDate", (q) => q.gte("serviceDate", today))
            .collect();

        // Filter to batches where this user is foreman or crew.
        const myBatches = batches.filter(
            (b) =>
                b.foremanName?.toLowerCase() === nameLower ||
                b.crewName?.toLowerCase() === nameLower
        );

        if (myBatches.length === 0) return [];

        // Batch-load all assignments for matching batches in parallel.
        const batchAssignmentArrays = await Promise.all(
            myBatches.map((batch) =>
                ctx.db
                    .query("assignments")
                    .withIndex("by_batch", (q) => q.eq("dispatchBatchId", batch._id))
                    .collect()
            )
        );

        // Flatten and build a batch-to-assignments map.
        const allAssignments: Array<{ assignment: any; batch: typeof myBatches[number] }> = [];
        for (let i = 0; i < myBatches.length; i++) {
            for (const assignment of batchAssignmentArrays[i]) {
                allAssignments.push({ assignment, batch: myBatches[i] });
            }
        }

        if (allAssignments.length === 0) return [];

        // Collect all unique jobRequestServiceIds, then batch-load them.
        const jrsIds = [...new Set(allAssignments.map((a) => a.assignment.jobRequestServiceId))];
        const jrsResults = await Promise.all(jrsIds.map((id) => ctx.db.get(id)));
        const jrsMap = new Map<string, Doc<"jobRequestServices">>();
        for (let i = 0; i < jrsIds.length; i++) {
            const jrs = jrsResults[i];
            if (jrs) jrsMap.set(jrsIds[i], jrs as Doc<"jobRequestServices">);
        }

        // Collect all unique jobRequestIds from the loaded JRS docs, then batch-load.
        const jrIds = [...new Set(
            [...jrsMap.values()].map((jrs) => jrs.jobRequestId)
        )] as Id<"jobRequests">[];
        const jrResults = await Promise.all(jrIds.map((id) => ctx.db.get(id)));
        const jrMap = new Map<string, Doc<"jobRequests">>();
        for (let i = 0; i < jrIds.length; i++) {
            const jr = jrResults[i];
            if (jr) jrMap.set(jrIds[i], jr);
        }

        // Collect all unique communityIds and builderIds from job requests.
        const communityIds = new Set<string>();
        const builderIds = new Set<string>();
        for (const jr of jrMap.values()) {
            if (jr.communityId) communityIds.add(jr.communityId as string);
            if (jr.builderId) builderIds.add(jr.builderId as string);
        }

        // Batch-load communities and builders in parallel.
        const communityIdArr = [...communityIds];
        const builderIdArr = [...builderIds];
        const [communityResults, builderResults] = await Promise.all([
            Promise.all(communityIdArr.map((id) => ctx.db.get(id as Id<"communities">))),
            Promise.all(builderIdArr.map((id) => ctx.db.get(id as Id<"builders">))),
        ]);
        const communityMap = new Map<string, Doc<"communities">>();
        for (let i = 0; i < communityIdArr.length; i++) {
            const c = communityResults[i];
            if (c) communityMap.set(communityIdArr[i], c);
        }
        const builderMap = new Map<string, Doc<"builders">>();
        for (let i = 0; i < builderIdArr.length; i++) {
            const b = builderResults[i];
            if (b) builderMap.set(builderIdArr[i], b);
        }

        // Assemble results with O(1) lookups from Maps.
        return allAssignments
            .map(({ assignment, batch }) => {
                const jrs = jrsMap.get(assignment.jobRequestServiceId);
                if (!jrs) return null;

                const jr = jrMap.get(jrs.jobRequestId) ?? null;
                const communityName = jr?.communityId
                    ? communityMap.get(jr.communityId as string)?.name ?? null
                    : null;
                const builderName = jr?.builderId
                    ? builderMap.get(jr.builderId as string)?.name ?? null
                    : null;

                return {
                    id: assignment._id,
                    serviceDate: batch.serviceDate,
                    communityName,
                    builderName,
                    lot: jr?.lot ?? null,
                    address: jr?.address ?? null,
                    serviceName: jrs.serviceName,
                    status: assignment.status,
                    crewName: batch.crewName,
                    foremanName: batch.foremanName,
                };
            })
            .filter((a): a is NonNullable<typeof a> => a !== null);
    },
});

export const setResetToken = mutation({
    args: {
        userId: v.id("users"),
        resetToken: v.string(),
        resetTokenExpiry: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.userId, {
            resetToken: args.resetToken,
            resetTokenExpiry: args.resetTokenExpiry,
            updatedAt: Date.now(),
        });
    },
});

export const getUserByResetToken = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_resetToken", (q) => q.eq("resetToken", args.token))
            .first();
        if (!user) return null;
        return {
            id: user._id,
            email: user.email,
            resetTokenExpiry: user.resetTokenExpiry,
        };
    },
});

export const updatePassword = mutation({
    args: {
        userId: v.id("users"),
        passwordHash: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.userId, {
            passwordHash: args.passwordHash,
            resetToken: undefined,
            resetTokenExpiry: undefined,
            updatedAt: Date.now(),
        });
    },
});

// Batch-loads all orgs into a Map for O(1) lookups (no N+1).
export const listWithOrgs = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const [users, orgs, allMemberships] = await Promise.all([
            ctx.db.query("users").take(args.limit ?? 1000),
            ctx.db.query("orgs").take(500),
            ctx.db.query("orgMembers").take(5000),
        ]);

        // Build org lookup map — single pass, O(1) per lookup.
        const orgMap = new Map(orgs.map((o) => [o._id, o]));

        // Group memberships by userId — single pass instead of N indexed queries.
        const membershipsByUser = new Map<string, typeof allMemberships>();
        for (const m of allMemberships) {
            const key = m.userId as string;
            const existing = membershipsByUser.get(key);
            if (existing) {
                existing.push(m);
            } else {
                membershipsByUser.set(key, [m]);
            }
        }

        const enrichedUsers = users.map((user) => {
            const memberships = membershipsByUser.get(user._id as string) ?? [];
            const membershipDetails = memberships.map((m) => {
                const org = orgMap.get(m.orgId);
                return {
                    orgId: m.orgId,
                    orgName: org?.name ?? "Unknown",
                    role: m.role,
                };
            });

            return {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                systemRole: user.role,
                preferredContactMethod: user.preferredContactMethod,
                memberships: membershipDetails,
            };
        });

        return {
            users: enrichedUsers,
            orgs: orgs.map((o) => ({ id: o._id, name: o.name, slug: o.slug })),
        };
    },
});
