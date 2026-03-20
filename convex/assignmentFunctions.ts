import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
    args: { id: v.id("assignments") },
    handler: async (ctx, args) => {
        const assignment = await ctx.db.get(args.id);
        if (!assignment) return null;

        const jrs = assignment.jobRequestServiceId
            ? await ctx.db.get(assignment.jobRequestServiceId)
            : null;
        const jr = jrs ? await ctx.db.get(jrs.jobRequestId) : null;

        let communityName = null;
        let builderName = null;
        let batch = null;

        if (jr?.communityId) {
            const c = await ctx.db.get(jr.communityId);
            communityName = c?.name ?? null;
        }
        if (jr?.builderId) {
            const b = await ctx.db.get(jr.builderId);
            builderName = b?.name ?? null;
        }
        if (assignment.dispatchBatchId) {
            batch = await ctx.db.get(assignment.dispatchBatchId);
        }

        return {
            id: assignment._id,
            status: assignment.status,
            notes: assignment.notes,
            windows: assignment.windows,
            tubs: assignment.tubs,
            foremanSig: assignment.foremanSig,
            customerSig: assignment.customerSig,
            serviceDate: batch?.serviceDate ?? null,
            crewName: batch?.crewName ?? null,
            foremanName: batch?.foremanName ?? null,
            communityName,
            builderName,
            lot: jr?.lot ?? null,
            address: jr?.address ?? null,
            serviceName: jrs?.serviceName ?? null,
            walkTime: jrs?.walkTime ?? null,
        };
    },
});

export const remove = mutation({
    args: { id: v.id("assignments") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return { success: true };
    },
});

export const complete = mutation({
    args: {
        id: v.id("assignments"),
        windows: v.optional(v.string()),
        tubs: v.optional(v.string()),
        notes: v.optional(v.string()),
        foremanSig: v.optional(v.string()),
        customerSig: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        await ctx.db.patch(id, {
            ...updates,
            status: "COMPLETE",
        });

        // Also update the linked job request service status
        const assignment = await ctx.db.get(id);
        if (assignment?.jobRequestServiceId) {
            await ctx.db.patch(assignment.jobRequestServiceId, {
                status: "COMPLETE",
            });

            // Propagate completion to linked Blue Book entries
            const linkedEntries = await ctx.db
                .query("blueBookEntries")
                .withIndex("by_jobRequestService", (q) =>
                    q.eq("jobRequestServiceId", assignment.jobRequestServiceId)
                )
                .collect();
            for (const entry of linkedEntries) {
                await ctx.db.patch(entry._id, {
                    status: "COMPLETE",
                    updatedAt: Date.now(),
                });
            }
        }

        return { success: true };
    },
});

export const submitTicket = mutation({
    args: {
        assignmentId: v.id("assignments"),
        windows: v.optional(v.string()),
        tubs: v.optional(v.string()),
        notes: v.optional(v.string()),
        foremanSig: v.optional(v.string()),
        customerSig: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { assignmentId, ...ticketData } = args;
        await ctx.db.patch(assignmentId, {
            ...ticketData,
            status: "COMPLETE",
        });

        const assignment = await ctx.db.get(assignmentId);
        if (assignment?.jobRequestServiceId) {
            await ctx.db.patch(assignment.jobRequestServiceId, {
                status: "COMPLETE",
            });

            // Propagate to Blue Book
            const linkedEntries = await ctx.db
                .query("blueBookEntries")
                .withIndex("by_jobRequestService", (q) =>
                    q.eq("jobRequestServiceId", assignment.jobRequestServiceId)
                )
                .collect();
            for (const entry of linkedEntries) {
                await ctx.db.patch(entry._id, {
                    status: "COMPLETE",
                    updatedAt: Date.now(),
                });
            }
        }

        return { success: true };
    },
});
