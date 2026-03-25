import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ── Role guard helper ─────────────────────────────────────────────────
async function requireRole(
    ctx: any,
    callerUserId: Id<"users">,
    allowedRoles: string[]
): Promise<void> {
    const caller = await ctx.db.get(callerUserId);
    if (!caller) throw new Error("User not found");
    const role = (caller.role ?? "").toUpperCase();
    if (!allowedRoles.includes(role)) {
        throw new Error(`Permission denied. Required role: ${allowedRoles.join(" or ")}`);
    }
}

// ── Helper: Find linked Blue Book entries for a job request service ───
async function findLinkedBlueBookEntries(ctx: any, jobRequestServiceId: string) {
    return await ctx.db
        .query("blueBookEntries")
        .withIndex("by_jobRequestService", (q: any) =>
            q.eq("jobRequestServiceId", jobRequestServiceId)
        )
        .collect();
}

// ── Helper: Find all Blue Book entries for a job request ──────────────
async function findBlueBookEntriesByJobRequest(ctx: any, jobRequestId: string) {
    return await ctx.db
        .query("blueBookEntries")
        .withIndex("by_jobRequest", (q: any) =>
            q.eq("jobRequestId", jobRequestId)
        )
        .collect();
}

// Assign foreman to a job (real-time sync → Blue Book)
export const assignForeman = mutation({
    args: {
        jobId: v.id("jobRequestServices"),
        foremanName: v.optional(v.string()),
        callerUserId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        if (args.callerUserId) {
            await requireRole(ctx, args.callerUserId, ["ADMIN", "BACKOFFICE", "DISPATCHER"]);
        }
        await ctx.db.patch(args.jobId, {
            assignedForemanName: args.foremanName ?? undefined,
        });

        // Propagate to linked Blue Book entries
        const linked = await findLinkedBlueBookEntries(ctx, args.jobId);
        for (const entry of linked) {
            await ctx.db.patch(entry._id, {
                assignedForemanName: args.foremanName ?? undefined,
                updatedAt: Date.now(),
            });
        }

        return { success: true };
    },
});

// Assign crew to a job (real-time sync → Blue Book)
export const assignCrew = mutation({
    args: {
        jobId: v.id("jobRequestServices"),
        crewName: v.optional(v.string()),
        callerUserId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        if (args.callerUserId) {
            await requireRole(ctx, args.callerUserId, ["ADMIN", "BACKOFFICE", "DISPATCHER"]);
        }
        await ctx.db.patch(args.jobId, {
            assignedCrewName: args.crewName ?? undefined,
        });

        // Propagate to linked Blue Book entries
        const linked = await findLinkedBlueBookEntries(ctx, args.jobId);
        for (const entry of linked) {
            await ctx.db.patch(entry._id, {
                crewName: args.crewName ?? undefined,
                updatedAt: Date.now(),
            });
        }

        return { success: true };
    },
});

// Reschedule a job — keeps original scheduledDate intact, sets rescheduledDate
export const rescheduleJob = mutation({
    args: {
        jobId: v.id("jobRequestServices"),
        newDate: v.string(),
        reason: v.optional(v.string()),
        callerUserId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        if (args.callerUserId) {
            await requireRole(ctx, args.callerUserId, ["ADMIN", "BACKOFFICE", "DISPATCHER"]);
        }
        await ctx.db.patch(args.jobId, {
            rescheduledDate: args.newDate,
            rescheduledReason: args.reason ?? undefined,
        });

        // Update start date on linked Blue Book entries
        const linked = await findLinkedBlueBookEntries(ctx, args.jobId);
        const startDateNum = new Date(args.newDate).getTime();
        for (const entry of linked) {
            await ctx.db.patch(entry._id, {
                startDate: args.newDate,
                startDateNum: isNaN(startDateNum) ? undefined : startDateNum,
                updatedAt: Date.now(),
            });
        }

        return { success: true };
    },
});

// Dispatch a job (create batch and assignment, sync → Blue Book)
export const dispatchJob = mutation({
    args: {
        jobId: v.id("jobRequestServices"),
        foremanName: v.string(),
        crewName: v.string(),
        serviceDate: v.string(),
        callerUserId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        if (args.callerUserId) {
            await requireRole(ctx, args.callerUserId, ["ADMIN", "BACKOFFICE", "DISPATCHER"]);
        }
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

        // Propagate to linked Blue Book entries
        const linked = await findLinkedBlueBookEntries(ctx, args.jobId);
        for (const entry of linked) {
            await ctx.db.patch(entry._id, {
                assignedForemanName: args.foremanName,
                crewName: args.crewName,
                status: "DISPATCHED",
                updatedAt: Date.now(),
            });
        }

        return { success: true, batchId };
    },
});

// Delete a dispatch batch
export const deleteDispatchBatch = mutation({
    args: {
        batchId: v.id("dispatchBatches"),
        callerUserId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        if (args.callerUserId) {
            await requireRole(ctx, args.callerUserId, ["ADMIN", "BACKOFFICE"]);
        }
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

// Create a new job request (from intake) — auto-creates Blue Book entries
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
        isExtraWork: v.optional(v.boolean()),
        services: v.array(v.object({
            serviceId: v.optional(v.id("services")),
            serviceName: v.string(),
            walkTime: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        // ── Input validation ─────────────────────────────────────────
        if (args.services.length === 0) {
            throw new Error("At least one service is required");
        }
        if (args.services.length > 20) {
            throw new Error("Maximum 20 services per job request");
        }
        if (args.dueDate && !/^\d{4}-\d{2}-\d{2}/.test(args.dueDate)) {
            throw new Error("dueDate must be ISO-8601 format (YYYY-MM-DD)");
        }
        if (args.lot && args.lot.trim().length === 0) {
            throw new Error("Lot cannot be empty whitespace");
        }

        const now = Date.now();

        // Auto-detect extra work:
        // 1. Explicit flag from intake form
        // 2. Service name contains "extra"
        // 3. Same community + lot already has a job (duplicate)
        let isExtraWork = args.isExtraWork ?? false;
        if (!isExtraWork) {
            const hasExtraService = args.services.some(
                (s) => s.serviceName.toLowerCase().includes("extra")
            );
            if (hasExtraService) isExtraWork = true;
        }
        if (!isExtraWork && args.communityId && args.lot) {
            const existing = await ctx.db
                .query("jobRequests")
                .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
                .filter((q) => q.eq(q.field("lot"), args.lot))
                .first();
            if (existing) isExtraWork = true;
        }

        // Resolve denormalized names for Blue Book entries
        let builderName: string | undefined;
        let communityName: string | undefined;
        let modelPlanCode: string | undefined;
        let modelPlanSqft: string | undefined;

        if (args.builderId) {
            const builder = await ctx.db.get(args.builderId);
            builderName = builder?.name;
        }
        if (args.communityId) {
            const community = await ctx.db.get(args.communityId);
            communityName = community?.name;
        }
        // Auto-resolve model plan if not provided: community lot → model plan
        let resolvedModelPlanId = args.modelPlanId;
        if (!resolvedModelPlanId && args.communityId && args.lot) {
            const lotRecord = await ctx.db
                .query("communityLots")
                .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
                .filter((q) => q.eq(q.field("lotNumber"), args.lot))
                .first();
            if (lotRecord?.modelPlanId) {
                resolvedModelPlanId = lotRecord.modelPlanId;
            }
        }
        if (!resolvedModelPlanId && args.communityId) {
            // Fallback: find any model plan linked to this community
            const communityPlan = await ctx.db
                .query("modelPlans")
                .filter((q) => q.eq(q.field("communityId"), args.communityId))
                .first();
            if (communityPlan) resolvedModelPlanId = communityPlan._id;
        }
        if (resolvedModelPlanId) {
            const mp = await ctx.db.get(resolvedModelPlanId);
            modelPlanCode = mp?.code ?? undefined;
            modelPlanSqft = mp?.sqft ?? undefined;
        }

        // Create job request
        const jobRequestId = await ctx.db.insert("jobRequests", {
            builderId: args.builderId,
            communityId: args.communityId,
            modelPlanId: resolvedModelPlanId,
            lot: args.lot,
            address: args.address,
            dueDate: args.dueDate,
            notes: args.notes,
            poNumber: args.poNumber,
            requestedBy: args.requestedBy,
            contactPhone: args.contactPhone,
            contactEmail: args.contactEmail,
            isExtraWork: isExtraWork || undefined,
            status: "PENDING",
            createdAt: now,
        });

        // Compute startDateNum for indexed sorting
        const startDateNum = args.dueDate
            ? new Date(args.dueDate).getTime()
            : undefined;

        // Create job request services + auto-create Blue Book entries
        for (const service of args.services) {
            const jrsId = await ctx.db.insert("jobRequestServices", {
                jobRequestId,
                serviceId: service.serviceId,
                serviceName: service.serviceName,
                walkTime: service.walkTime,
                assignedForemanName: args.requestedBy,
                status: "PENDING",
                scheduledDate: args.dueDate,
                createdAt: now,
            });

            // Auto-create linked Blue Book entry with available fields
            await ctx.db.insert("blueBookEntries", {
                jobRequestId,
                jobRequestServiceId: jrsId,
                builderId: args.builderId,
                communityId: args.communityId,
                modelPlanId: args.modelPlanId,
                serviceId: service.serviceId,
                lot: args.lot,
                startDate: args.dueDate,
                startDateNum: startDateNum && !isNaN(startDateNum) ? startDateNum : undefined,
                // Denormalized names
                builderName,
                communityName,
                serviceName: service.serviceName,
                modelPlanCode,
                modelPlanSqft,
                // Fields that will be filled as the job progresses
                assignedForemanName: args.requestedBy,
                poNumber: args.poNumber,
                status: "PENDING",
                source: "intake",
                createdAt: now,
                updatedAt: now,
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
        permissions: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // ── Input validation ─────────────────────────────────────────
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(args.email)) {
            throw new Error("Invalid email format");
        }
        const validRoles = ["ADMIN", "BACKOFFICE", "FOREMAN", "CREW", "CONTRACTOR", "DISPATCHER", "VIEWER", "MEMBER"];
        if (!validRoles.includes(args.role)) {
            throw new Error(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
        }
        if (args.name !== undefined && (args.name.length < 1 || args.name.length > 100)) {
            throw new Error("Name must be 1-100 characters");
        }

        const userId = await ctx.db.insert("users", {
            email: args.email.toLowerCase().trim(),
            name: args.name?.trim(),
            phone: args.phone?.trim(),
            role: args.role,
            passwordHash: args.passwordHash,
            permissions: args.permissions,
            createdAt: Date.now(),
        });
        return { success: true, userId };
    },
});

// Ensure user exists in Convex when signed in via Clerk
// Called on first load — finds by email or creates with VIEWER role
export const ensureUser = mutation({
    args: {
        email: v.string(),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const email = args.email.toLowerCase().trim();
        const existing = await ctx.db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("email", email))
            .first();
        if (existing) return existing._id;

        const userId = await ctx.db.insert("users", {
            email,
            name: args.name?.trim() ?? email.split("@")[0],
            role: "VIEWER",
            createdAt: Date.now(),
        });
        return userId;
    },
});

// Update user (admin-only)
export const updateUser = mutation({
    args: {
        userId: v.id("users"),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
        role: v.optional(v.string()),
        passwordHash: v.optional(v.string()),
        permissions: v.optional(v.string()),
        callerUserId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        if (args.callerUserId) {
            await requireRole(ctx, args.callerUserId, ["ADMIN"]);
        }
        const updates: any = { updatedAt: Date.now() };
        if (args.name !== undefined) updates.name = args.name;
        if (args.phone !== undefined) updates.phone = args.phone;
        if (args.role !== undefined) updates.role = args.role;
        if (args.passwordHash) updates.passwordHash = args.passwordHash;
        if (args.permissions !== undefined) updates.permissions = args.permissions;

        await ctx.db.patch(args.userId, updates);
        return { success: true };
    },
});

// Delete user (admin-only)
export const deleteUser = mutation({
    args: {
        userId: v.id("users"),
        callerUserId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        if (args.callerUserId) {
            await requireRole(ctx, args.callerUserId, ["ADMIN"]);
        }
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
        const trimmedName = args.name.trim();
        if (trimmedName.length < 1 || trimmedName.length > 100) {
            throw new Error("Organization name must be 1-100 characters");
        }
        const slug = trimmedName.toLowerCase().replace(/\s+/g, "-");
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
            await ctx.db.patch(existing._id, { role: args.role });
        } else {
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
        const trimmed = args.name.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            throw new Error("Builder name must be 1-100 characters");
        }
        const id = await ctx.db.insert("builders", {
            name: trimmed,
            active: true,
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
        const trimmed = args.name.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            throw new Error("Community name must be 1-100 characters");
        }
        // Prevent duplicate communities with same name
        const existing = await ctx.db
            .query("communities")
            .filter((q) => q.eq(q.field("normalizedName"), trimmed.toLowerCase()))
            .collect();
        const duplicate = existing.find(
            (c) => c.active !== false && (
                c.builderId === args.builderId ||
                !c.builderId ||
                !args.builderId
            )
        );
        if (duplicate) {
            throw new Error(`Community "${trimmed}" already exists`);
        }
        const id = await ctx.db.insert("communities", {
            name: trimmed,
            normalizedName: trimmed.toLowerCase(),
            builderId: args.builderId,
            active: true,
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
        const trimmed = args.name.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            throw new Error("Service name must be 1-100 characters");
        }
        const id = await ctx.db.insert("services", {
            name: trimmed,
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

// ── Find-or-Create (upsert) for imports ──────────────────────────────

export const findOrCreateBuilder = mutation({
    args: { name: v.string() },
    handler: async (ctx, args) => {
        const trimmed = args.name.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            throw new Error("Builder name must be 1-100 characters");
        }
        const existing = await ctx.db
            .query("builders")
            .withIndex("by_name", (q) => q.eq("name", trimmed))
            .first();
        if (existing) return { id: existing._id, existed: true };
        const id = await ctx.db.insert("builders", {
            name: trimmed,
            active: true,
            createdAt: Date.now(),
        });
        return { id, existed: false };
    },
});

export const findOrCreateCommunity = mutation({
    args: {
        name: v.string(),
        builderId: v.optional(v.id("builders")),
    },
    handler: async (ctx, args) => {
        const trimmed = args.name.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            throw new Error("Community name must be 1-100 characters");
        }
        const existing = await ctx.db
            .query("communities")
            .withIndex("by_normalizedName", (q) => q.eq("normalizedName", trimmed.toLowerCase()))
            .first();
        if (existing && existing.active !== false) {
            return { id: existing._id, existed: true };
        }
        const id = await ctx.db.insert("communities", {
            name: trimmed,
            normalizedName: trimmed.toLowerCase(),
            builderId: args.builderId,
            active: true,
            createdAt: Date.now(),
        });
        return { id, existed: false };
    },
});

// Normalize service name for fuzzy matching: lowercase, collapse whitespace,
// strip trailing "ing"/"s", common synonyms → canonical form
function normalizeServiceName(name: string): string {
    let n = name.toLowerCase().trim().replace(/\s+/g, ' ');
    // Common cleaning industry synonyms
    const synonyms: [RegExp, string][] = [
        [/\bpower\s*wash(ing)?\b/, 'powerwash'],
        [/\bpressure\s*wash(ing)?\b/, 'powerwash'],
        [/\bfinal\s*clean(ing)?\b/, 'final clean'],
        [/\brough\s*clean(ing)?\b/, 'rough clean'],
        [/\bframe\s*sweep(ing)?\b/, 'frame sweep'],
        [/\btouch\s*up\s*clean(ing)?\b/, 'touch up clean'],
        [/\bmove[\s-]*in\s*clean(ing)?\b/, 'move in clean'],
        [/\bcarpet\s*sweep(ing)?\b/, 'carpet sweep'],
        [/\btubs?\s*(&|and)\s*windows?\b/, 'tubs & windows'],
        [/\bq\/?a\b/, 'qa'],
    ];
    for (const [pattern, replacement] of synonyms) {
        n = n.replace(pattern, replacement);
    }
    // Strip trailing "ing" and plural "s" for generic matching
    n = n.replace(/\b(\w{4,})ing\b/g, '$1').replace(/\b(\w{4,})s\b/g, '$1');
    return n.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export const findOrCreateService = mutation({
    args: {
        name: v.string(),
        description: v.optional(v.string()),
        code: v.optional(v.string()),
        category: v.optional(v.string()),
        unitKind: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const trimmed = args.name.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            throw new Error("Service name must be 1-100 characters");
        }
        const normalized = normalizeServiceName(trimmed);

        // 1. Exact name match
        const exactMatch = await ctx.db
            .query("services")
            .withIndex("by_name", (q) => q.eq("name", trimmed))
            .first();
        if (exactMatch) return { id: exactMatch._id, existed: true };

        // 2. Normalized name match (fuzzy)
        const normalizedMatch = await ctx.db
            .query("services")
            .withIndex("by_normalizedName", (q) => q.eq("normalizedName", normalized))
            .first();
        if (normalizedMatch) return { id: normalizedMatch._id, existed: true };

        // 3. Scan active services for word-overlap similarity (catches edge cases)
        const allActive = await ctx.db
            .query("services")
            .withIndex("by_active", (q) => q.eq("active", true))
            .collect();
        const inputWords = new Set(normalized.split(' '));
        for (const svc of allActive) {
            const svcNorm = normalizeServiceName(svc.name);
            const svcWords = new Set(svcNorm.split(' '));
            const overlap = [...inputWords].filter(w => svcWords.has(w)).length;
            const maxLen = Math.max(inputWords.size, svcWords.size);
            // 80%+ word overlap = same service
            if (maxLen > 0 && overlap / maxLen >= 0.8) {
                // Backfill normalizedName if missing
                if (!svc.normalizedName) {
                    await ctx.db.patch(svc._id, { normalizedName: svcNorm });
                }
                return { id: svc._id, existed: true };
            }
        }

        // 4. Create new
        const id = await ctx.db.insert("services", {
            name: trimmed,
            normalizedName: normalized,
            description: args.description,
            code: args.code,
            category: args.category,
            unitKind: args.unitKind,
            active: true,
            createdAt: Date.now(),
        });
        return { id, existed: false };
    },
});

export const findOrCreateModelPlan = mutation({
    args: {
        name: v.string(),
        sqft: v.optional(v.string()),
        code: v.optional(v.string()),
        communityId: v.optional(v.id("communities")),
        builderId: v.optional(v.id("builders")),
    },
    handler: async (ctx, args) => {
        const trimmed = args.name.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            throw new Error("Model plan name must be 1-100 characters");
        }
        const normalized = trimmed.toLowerCase();

        // Look for existing plan by name within the same community (or globally)
        let existing;
        if (args.communityId) {
            existing = await ctx.db
                .query("modelPlans")
                .withIndex("by_community_name", (q) =>
                    q.eq("communityId", args.communityId).eq("normalizedName", normalized)
                )
                .first();
        }
        if (!existing) {
            existing = await ctx.db
                .query("modelPlans")
                .withIndex("by_normalizedName", (q) => q.eq("normalizedName", normalized))
                .first();
        }
        if (existing && existing.active !== false) {
            // Backfill missing fields on existing plan
            const patch: Record<string, unknown> = {};
            if (args.sqft && !existing.sqft) patch.sqft = args.sqft;
            if (args.communityId && !existing.communityId) patch.communityId = args.communityId;
            if (args.builderId && !existing.builderId) patch.builderId = args.builderId;
            if (!existing.normalizedName) patch.normalizedName = normalized;
            if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch);
            return { id: existing._id, existed: true };
        }

        const id = await ctx.db.insert("modelPlans", {
            name: trimmed,
            normalizedName: normalized,
            code: args.code,
            sqft: args.sqft,
            communityId: args.communityId,
            builderId: args.builderId,
            active: true,
            createdAt: Date.now(),
        });
        return { id, existed: false };
    },
});

// ── Import History ───────────────────────────────────────────────────

export const createImportRecord = mutation({
    args: {
        fileName: v.string(),
        fileHash: v.string(),
        fileSize: v.number(),
        documentType: v.optional(v.string()),
        detectedTargets: v.array(v.string()),
        rowCount: v.number(),
        results: v.string(),
        fieldMapping: v.optional(v.string()),
        parsedRows: v.optional(v.string()),
        rawRows: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("importHistory", {
            ...args,
            createdAt: Date.now(),
        });
        return { id };
    },
});

export const updateImportRecord = mutation({
    args: {
        id: v.id("importHistory"),
        parsedRows: v.optional(v.string()),
        rawRows: v.optional(v.string()),
        fieldMapping: v.optional(v.string()),
        results: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const filtered: Record<string, string> = {};
        for (const [k, val] of Object.entries(updates)) {
            if (val !== undefined) filtered[k] = val;
        }
        await ctx.db.patch(id, filtered);
        return { success: true };
    },
});

export const createImportedEntity = mutation({
    args: {
        importId: v.id("importHistory"),
        entityType: v.string(),
        entityId: v.string(),
        rowIndex: v.number(),
        mappedData: v.string(),
        existed: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("importedEntities", {
            ...args,
            createdAt: Date.now(),
        });
        return { id };
    },
});

export const updateImportedEntityData = mutation({
    args: {
        id: v.id("importedEntities"),
        mappedData: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { mappedData: args.mappedData });
        return { success: true };
    },
});

// Soft-delete an import record + cascade deactivate selected linked entities
export const softDeleteImport = mutation({
    args: {
        id: v.id("importHistory"),
        keepEntityIds: v.optional(v.array(v.string())), // entity IDs user chose to KEEP
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { deletedAt: Date.now() });

        // Cascade: deactivate all entities that were created by this import
        const linked = await ctx.db
            .query("importedEntities")
            .withIndex("by_import", (q) => q.eq("importId", args.id))
            .collect();

        const keepSet = new Set(args.keepEntityIds ?? []);
        let deactivated = 0;
        for (const entity of linked) {
            if (entity.existed) continue; // Don't touch pre-existing entities
            if (keepSet.has(entity.entityId)) continue; // User chose to keep this
            try {
                const doc = await ctx.db.get(entity.entityId as any);
                if (!doc) continue;
                if (entity.entityType === 'blueBookEntry') {
                    await ctx.db.patch(entity.entityId as any, { status: 'DELETED' } as any);
                } else if (entity.entityType === 'jobRequest') {
                    await ctx.db.patch(entity.entityId as any, { status: 'DELETED' } as any);
                } else {
                    // Builders, communities, services: set active = false
                    await ctx.db.patch(entity.entityId as any, { active: false } as any);
                }
                // Mark link record so restore knows which were actually deactivated
                await ctx.db.patch(entity._id, { deactivated: true });
                deactivated++;
            } catch { /* entity may already be gone */ }
        }
        return { success: true, deactivated };
    },
});

// Restore a soft-deleted import + reactivate only entities that were deactivated
export const restoreImport = mutation({
    args: { id: v.id("importHistory") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { deletedAt: undefined });

        // Cascade: reactivate only entities that were actually deactivated during soft-delete
        const linked = await ctx.db
            .query("importedEntities")
            .withIndex("by_import", (q) => q.eq("importId", args.id))
            .collect();

        let reactivated = 0;
        for (const entity of linked) {
            if (entity.existed) continue;
            if (!entity.deactivated) continue; // Only restore what was deactivated
            try {
                const doc = await ctx.db.get(entity.entityId as any);
                if (!doc) continue;
                if (entity.entityType === 'blueBookEntry') {
                    await ctx.db.patch(entity.entityId as any, { status: 'PENDING' } as any);
                } else if (entity.entityType === 'jobRequest') {
                    await ctx.db.patch(entity.entityId as any, { status: 'PENDING' } as any);
                } else {
                    await ctx.db.patch(entity.entityId as any, { active: true } as any);
                }
                // Clear the deactivated flag
                await ctx.db.patch(entity._id, { deactivated: undefined });
                reactivated++;
            } catch { /* entity may be gone */ }
        }
        return { success: true, reactivated };
    },
});

// Hard-delete an import + cascade delete selected linked entities
export const hardDeleteImport = mutation({
    args: {
        id: v.id("importHistory"),
        entityIdsToDelete: v.array(v.string()), // entity IDs to cascade-delete
    },
    handler: async (ctx, args) => {
        // Delete selected linked entities from their respective tables
        const linkedEntities = await ctx.db
            .query("importedEntities")
            .withIndex("by_import", (q) => q.eq("importId", args.id))
            .collect();

        const deleteSet = new Set(args.entityIdsToDelete);

        for (const entity of linkedEntities) {
            if (deleteSet.has(entity.entityId)) {
                // Try to soft-delete or hard-delete the actual entity
                try {
                    const entityDoc = await ctx.db.get(entity.entityId as any);
                    if (entityDoc) {
                        // Soft delete for main entities, hard delete for entries
                        if (entity.entityType === 'blueBookEntry') {
                            await ctx.db.delete(entity.entityId as any);
                        } else {
                            await ctx.db.patch(entity.entityId as any, { active: false } as any);
                        }
                    }
                } catch {
                    // Entity may already be deleted
                }
            }
            // Always delete the link record
            await ctx.db.delete(entity._id);
        }

        // Delete the import record itself
        await ctx.db.delete(args.id);
        return { success: true, deletedEntities: deleteSet.size };
    },
});

// Purge imports soft-deleted more than 90 days ago (called by cron)
export const purgeOldImports = mutation({
    handler: async (ctx) => {
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const expired = await ctx.db
            .query("importHistory")
            .withIndex("by_deletedAt")
            .filter((q) => q.and(
                q.neq(q.field("deletedAt"), undefined),
                q.lt(q.field("deletedAt"), cutoff)
            ))
            .take(50); // batch to avoid timeouts

        let purged = 0;
        for (const record of expired) {
            // Delete all linked entities
            const linked = await ctx.db
                .query("importedEntities")
                .withIndex("by_import", (q) => q.eq("importId", record._id))
                .collect();
            for (const entity of linked) {
                try {
                    const doc = await ctx.db.get(entity.entityId as any);
                    if (doc) {
                        if (entity.entityType === 'blueBookEntry') {
                            await ctx.db.delete(entity.entityId as any);
                        } else {
                            await ctx.db.patch(entity.entityId as any, { active: false } as any);
                        }
                    }
                } catch { /* already gone */ }
                await ctx.db.delete(entity._id);
            }
            await ctx.db.delete(record._id);
            purged++;
        }
        return { purged };
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
        // Keep normalizedName in sync
        if (updates.name) {
            filtered.normalizedName = updates.name.toLowerCase().trim();
        }
        await ctx.db.patch(id, filtered);

        // Cascade builder change to Blue Book entries + job requests referencing this community
        if (updates.builderId) {
            const newBuilder = await ctx.db.get(updates.builderId);
            const newBuilderName = newBuilder?.name;

            // Update Blue Book entries
            const bbEntries = await ctx.db
                .query("blueBookEntries")
                .withIndex("by_community", (q: any) => q.eq("communityId", id))
                .collect();
            for (const entry of bbEntries) {
                await ctx.db.patch(entry._id, {
                    builderId: updates.builderId,
                    builderName: newBuilderName,
                    updatedAt: Date.now(),
                });
            }

            // Update job requests
            const jobRequests = await ctx.db
                .query("jobRequests")
                .withIndex("by_community", (q: any) => q.eq("communityId", id))
                .collect();
            for (const jr of jobRequests) {
                await ctx.db.patch(jr._id, { builderId: updates.builderId });
            }

            // Update community name on entries if name also changed
            if (updates.name) {
                for (const entry of bbEntries) {
                    await ctx.db.patch(entry._id, { communityName: updates.name });
                }
            }
        } else if (updates.name) {
            // Only name changed — update denormalized communityName on Blue Book entries
            const bbEntries = await ctx.db
                .query("blueBookEntries")
                .withIndex("by_community", (q: any) => q.eq("communityId", id))
                .collect();
            for (const entry of bbEntries) {
                await ctx.db.patch(entry._id, {
                    communityName: updates.name,
                    updatedAt: Date.now(),
                });
            }
        }

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
        const trimmed = args.name.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            throw new Error("Crew name must be 1-100 characters");
        }
        if (args.capacityPerDay !== undefined && args.capacityPerDay <= 0) {
            throw new Error("capacityPerDay must be greater than 0");
        }
        const id = await ctx.db.insert("crews", {
            name: trimmed,
            foremanId: args.foremanId,
            skills: args.skills,
            capacityPerDay: args.capacityPerDay,
            createdAt: Date.now(),
        });
        return { success: true, id };
    },
});
