import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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

export const getForemanContact = query({
    args: { name: v.string() },
    handler: async (ctx, args) => {
        const users = await ctx.db.query("users").collect();
        const match = users.find(
            (u) => u.name?.toLowerCase() === args.name.toLowerCase()
        );
        if (!match) return null;
        return {
            name: match.name,
            email: match.email,
            phone: match.phone,
            preferredContactMethod: match.preferredContactMethod ?? 'email',
        };
    },
});

export const getMyAssignments = query({
    args: { userName: v.string() },
    handler: async (ctx, args) => {
        const today = new Date().toISOString().split('T')[0];
        const batches = await ctx.db.query("dispatchBatches").collect();

        // Filter to current/future batches matching this user
        const myBatches = batches.filter(
            (b) =>
                (b.serviceDate ?? '') >= today &&
                (b.foremanName?.toLowerCase() === args.userName.toLowerCase() ||
                    b.crewName?.toLowerCase() === args.userName.toLowerCase())
        );

        const assignments: any[] = [];

        for (const batch of myBatches) {
            const batchAssignments = await ctx.db
                .query("assignments")
                .withIndex("by_batch", (q) => q.eq("dispatchBatchId", batch._id))
                .collect();

            for (const assignment of batchAssignments) {
                const jrs = await ctx.db.get(assignment.jobRequestServiceId);
                if (!jrs) continue;

                const jr = await ctx.db.get(jrs.jobRequestId);
                let communityName = null;
                let builderName = null;

                if (jr?.communityId) {
                    const c = await ctx.db.get(jr.communityId);
                    communityName = c?.name ?? null;
                }
                if (jr?.builderId) {
                    const b = await ctx.db.get(jr.builderId);
                    builderName = b?.name ?? null;
                }

                assignments.push({
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
                });
            }
        }

        return assignments;
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

export const listWithOrgs = query({
    handler: async (ctx) => {
        const users = await ctx.db.query("users").collect();
        const orgs = await ctx.db.query("orgs").collect();

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
                    preferredContactMethod: user.preferredContactMethod,
                    memberships: membershipDetails,
                };
            })
        );

        return {
            users: enrichedUsers,
            orgs: orgs.map((o) => ({ id: o._id, name: o.name, slug: o.slug })),
        };
    },
});
