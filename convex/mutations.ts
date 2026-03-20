import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Assign foreman to a job (real-time sync)
export const assignForeman = mutation({
    args: {
        jobId: v.id("jobRequestServices"),
        foremanName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, {
            assignedForemanName: args.foremanName ?? undefined,
        });
        return { success: true };
    },
});

// Assign crew to a job
export const assignCrew = mutation({
    args: {
        jobId: v.id("jobRequestServices"),
        crewName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, {
            assignedCrewName: args.crewName ?? undefined,
        });
        return { success: true };
    },
});

// Reschedule a job
export const rescheduleJob = mutation({
    args: {
        jobId: v.id("jobRequestServices"),
        newDate: v.string(),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, {
            rescheduledDate: args.newDate,
            rescheduledReason: args.reason ?? undefined,
            scheduledDate: args.newDate, // Update the scheduled date as well
        });
        return { success: true };
    },
});

// Dispatch a job (create batch and assignment)
export const dispatchJob = mutation({
    args: {
        jobId: v.id("jobRequestServices"),
        foremanName: v.string(),
        crewName: v.string(),
        serviceDate: v.string(),
    },
    handler: async (ctx, args) => {
        // Update the job with foreman and crew
        await ctx.db.patch(args.jobId, {
            assignedForemanName: args.foremanName,
            assignedCrewName: args.crewName,
            status: "DISPATCHED",
        });

        // Create a dispatch batch
        const batchId = await ctx.db.insert("dispatchBatches", {
            serviceDate: args.serviceDate,
            status: "SENT",
            crewName: args.crewName,
            foremanName: args.foremanName,
            createdAt: Date.now(),
        });

        // Create assignment linking job to batch
        await ctx.db.insert("assignments", {
            jobRequestServiceId: args.jobId,
            dispatchBatchId: batchId,
            status: "SENT",
            createdAt: Date.now(),
        });

        return { success: true, batchId };
    },
});

// Delete a dispatch batch
export const deleteDispatchBatch = mutation({
    args: { batchId: v.id("dispatchBatches") },
    handler: async (ctx, args) => {
        // Delete assignments first
        const assignments = await ctx.db
            .query("assignments")
            .withIndex("by_batch", (q) => q.eq("dispatchBatchId", args.batchId))
            .collect();

        for (const assignment of assignments) {
            await ctx.db.delete(assignment._id);
        }

        // Delete the batch
        await ctx.db.delete(args.batchId);
        return { success: true };
    },
});

// Create a new job request (from intake)
export const createJobRequest = mutation({
    args: {
        builderId: v.optional(v.id("builders")),
        communityId: v.optional(v.id("communities")),
        modelPlanId: v.optional(v.id("modelPlans")),
        lot: v.optional(v.string()),
        address: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        notes: v.optional(v.string()),
        poNumber: v.optional(v.string()),
        requestedBy: v.optional(v.string()),
        contactPhone: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        services: v.array(v.object({
            serviceId: v.optional(v.id("services")),
            serviceName: v.string(),
            walkTime: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        // Create job request
        const jobRequestId = await ctx.db.insert("jobRequests", {
            builderId: args.builderId,
            communityId: args.communityId,
            modelPlanId: args.modelPlanId,
            lot: args.lot,
            address: args.address,
            dueDate: args.dueDate,
            notes: args.notes,
            poNumber: args.poNumber,
            requestedBy: args.requestedBy,
            contactPhone: args.contactPhone,
            contactEmail: args.contactEmail,
            createdAt: Date.now(),
        });

        // Create job request services
        for (const service of args.services) {
            await ctx.db.insert("jobRequestServices", {
                jobRequestId,
                serviceId: service.serviceId,
                serviceName: service.serviceName,
                walkTime: service.walkTime,
                status: "PENDING",
                scheduledDate: args.dueDate,
                createdAt: Date.now(),
            });
        }

        return { success: true, jobRequestId };
    },
});

// Create user
export const createUser = mutation({
    args: {
        email: v.string(),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
        role: v.string(),
        passwordHash: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await ctx.db.insert("users", {
            email: args.email,
            name: args.name,
            phone: args.phone,
            role: args.role,
            passwordHash: args.passwordHash,
            createdAt: Date.now(),
        });
        return { success: true, userId };
    },
});

// Update user
export const updateUser = mutation({
    args: {
        userId: v.id("users"),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
        passwordHash: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const updates: any = { updatedAt: Date.now() };
        if (args.name !== undefined) updates.name = args.name;
        if (args.phone !== undefined) updates.phone = args.phone;
        if (args.passwordHash) updates.passwordHash = args.passwordHash;

        await ctx.db.patch(args.userId, updates);
        return { success: true };
    },
});

// Delete user
export const deleteUser = mutation({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        // Delete org memberships first
        const memberships = await ctx.db
            .query("orgMembers")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        for (const m of memberships) {
            await ctx.db.delete(m._id);
        }

        await ctx.db.delete(args.userId);
        return { success: true };
    },
});

// Create organization
export const createOrg = mutation({
    args: { name: v.string() },
    handler: async (ctx, args) => {
        const slug = args.name.toLowerCase().replace(/\s+/g, "-");
        const orgId = await ctx.db.insert("orgs", {
            name: args.name,
            slug,
            createdAt: Date.now(),
        });
        return { success: true, orgId };
    },
});

// Update organization
export const updateOrg = mutation({
    args: { orgId: v.id("orgs"), name: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.orgId, { name: args.name });
        return { success: true };
    },
});

// Delete organization
export const deleteOrg = mutation({
    args: { orgId: v.id("orgs") },
    handler: async (ctx, args) => {
        // Delete memberships first
        const memberships = await ctx.db
            .query("orgMembers")
            .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
            .collect();

        for (const m of memberships) {
            await ctx.db.delete(m._id);
        }

        await ctx.db.delete(args.orgId);
        return { success: true };
    },
});

// Assign org membership
export const assignOrgMembership = mutation({
    args: {
        userId: v.id("users"),
        orgId: v.id("orgs"),
        role: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if membership already exists
        const existing = await ctx.db
            .query("orgMembers")
            .withIndex("by_org_user", (q) =>
                q.eq("orgId", args.orgId).eq("userId", args.userId)
            )
            .first();

        if (existing) {
            // Update existing
            await ctx.db.patch(existing._id, { role: args.role });
        } else {
            // Create new
            await ctx.db.insert("orgMembers", {
                userId: args.userId,
                orgId: args.orgId,
                role: args.role,
                createdAt: Date.now(),
            });
        }
        return { success: true };
    },
});

// Create builder
export const createBuilder = mutation({
    args: { name: v.string() },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("builders", {
            name: args.name,
            createdAt: Date.now(),
        });
        return { success: true, id };
    },
});

// Create community
export const createCommunity = mutation({
    args: {
        name: v.string(),
        builderId: v.optional(v.id("builders")),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("communities", {
            name: args.name,
            builderId: args.builderId,
            createdAt: Date.now(),
        });
        return { success: true, id };
    },
});

// Create service
export const createService = mutation({
    args: {
        name: v.string(),
        description: v.optional(v.string()),
        code: v.optional(v.string()),
        category: v.optional(v.string()),
        unitKind: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("services", {
            name: args.name,
            description: args.description,
            code: args.code,
            category: args.category,
            unitKind: args.unitKind,
            active: true,
            createdAt: Date.now(),
        });
        return { success: true, id };
    },
});

// ── Services CRUD ─────────────────────────────────────────────────────

export const updateService = mutation({
    args: {
        id: v.id("services"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        code: v.optional(v.string()),
        category: v.optional(v.string()),
        unitKind: v.optional(v.string()),
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

export const deleteService = mutation({
    args: { id: v.id("services") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { active: false });
        return { success: true };
    },
});

// ── Model Plans CRUD ──────────────────────────────────────────────────

export const createModelPlan = mutation({
    args: {
        name: v.string(),
        builderId: v.optional(v.id("builders")),
        communityId: v.optional(v.id("communities")),
        code: v.optional(v.string()),
        sqft: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("modelPlans", {
            ...args,
            active: true,
            createdAt: Date.now(),
        });
        return { success: true, id };
    },
});

export const updateModelPlan = mutation({
    args: {
        id: v.id("modelPlans"),
        name: v.optional(v.string()),
        code: v.optional(v.string()),
        sqft: v.optional(v.string()),
        builderId: v.optional(v.id("builders")),
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

export const deleteModelPlan = mutation({
    args: { id: v.id("modelPlans") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { active: false });
        return { success: true };
    },
});

// ── Builders CRUD ─────────────────────────────────────────────────────

export const updateBuilder = mutation({
    args: {
        id: v.id("builders"),
        name: v.optional(v.string()),
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

export const deleteBuilder = mutation({
    args: { id: v.id("builders") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { active: false });
        return { success: true };
    },
});

// ── Communities CRUD ──────────────────────────────────────────────────

export const updateCommunity = mutation({
    args: {
        id: v.id("communities"),
        name: v.optional(v.string()),
        builderId: v.optional(v.id("builders")),
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

export const deleteCommunity = mutation({
    args: { id: v.id("communities") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { active: false });
        return { success: true };
    },
});

// Create crew
export const createCrew = mutation({
    args: {
        name: v.string(),
        foremanId: v.optional(v.id("users")),
        skills: v.optional(v.array(v.string())),
        capacityPerDay: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("crews", {
            name: args.name,
            foremanId: args.foremanId,
            skills: args.skills,
            capacityPerDay: args.capacityPerDay,
            createdAt: Date.now(),
        });
        return { success: true, id };
    },
});
