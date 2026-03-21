/**
 * Maintenance tasks — scheduled cleanup of soft-deleted and stale records.
 * Runs monthly via cron to keep the database lean and prevent
 * soft-deleted records from interfering with duplicate detection.
 */
import { internalMutation } from "./_generated/server";

/**
 * Purge soft-deleted master data (active === false) older than 90 days.
 * Also hard-deletes COMPLETE job requests (and their children) older than 90 days
 * so they don't accumulate and slow down queries.
 */
export const purgeStaleRecords = internalMutation({
    handler: async (ctx) => {
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days ago
        const stats = {
            builders: 0,
            communities: 0,
            services: 0,
            modelPlans: 0,
            contractRates: 0,
            completedJobs: 0,
            completedServices: 0,
            orphanedAssignments: 0,
            emptyBatches: 0,
        };

        // 1. Purge soft-deleted builders
        const builders = await ctx.db.query("builders").collect();
        for (const b of builders) {
            if (b.active === false && b._creationTime < cutoff) {
                await ctx.db.delete(b._id);
                stats.builders++;
            }
        }

        // 2. Purge soft-deleted communities
        const communities = await ctx.db.query("communities").collect();
        for (const c of communities) {
            if (c.active === false && c._creationTime < cutoff) {
                await ctx.db.delete(c._id);
                stats.communities++;
            }
        }

        // 3. Purge soft-deleted services
        const services = await ctx.db.query("services").collect();
        for (const s of services) {
            if (s.active === false && s._creationTime < cutoff) {
                await ctx.db.delete(s._id);
                stats.services++;
            }
        }

        // 4. Purge soft-deleted model plans
        const modelPlans = await ctx.db.query("modelPlans").collect();
        for (const mp of modelPlans) {
            if (mp.active === false && mp._creationTime < cutoff) {
                await ctx.db.delete(mp._id);
                stats.modelPlans++;
            }
        }

        // 5. Purge soft-deleted contract rates
        const rates = await ctx.db.query("contractRates").collect();
        for (const r of rates) {
            if ((r as any).active === false && r._creationTime < cutoff) {
                await ctx.db.delete(r._id);
                stats.contractRates++;
            }
        }

        // 6. Purge COMPLETE job requests older than 90 days (cascade)
        const jobRequests = await ctx.db
            .query("jobRequests")
            .withIndex("by_status", (q) => q.eq("status", "COMPLETE"))
            .collect();

        for (const jr of jobRequests) {
            if (jr.createdAt > cutoff) continue; // keep recent completions

            // Delete child services
            const jrServices = await ctx.db
                .query("jobRequestServices")
                .withIndex("by_jobRequest", (q) => q.eq("jobRequestId", jr._id))
                .collect();

            for (const svc of jrServices) {
                // Delete assignments for this service
                const assignments = await ctx.db
                    .query("assignments")
                    .filter((q) => q.eq(q.field("jobRequestServiceId"), svc._id))
                    .collect();
                for (const a of assignments) {
                    await ctx.db.delete(a._id);
                    stats.orphanedAssignments++;
                }
                await ctx.db.delete(svc._id);
                stats.completedServices++;
            }

            // Delete blue book entries linked to this job request
            const bbEntries = await ctx.db
                .query("blueBookEntries")
                .filter((q) => q.eq(q.field("jobRequestId"), jr._id))
                .collect();
            for (const bb of bbEntries) {
                await ctx.db.delete(bb._id);
            }

            await ctx.db.delete(jr._id);
            stats.completedJobs++;
        }

        // 7. Clean up empty dispatch batches older than 90 days
        const batches = await ctx.db.query("dispatchBatches").collect();
        for (const batch of batches) {
            if (batch._creationTime > cutoff) continue;
            const assignments = await ctx.db
                .query("assignments")
                .withIndex("by_batch", (q) => q.eq("dispatchBatchId", batch._id))
                .first();
            if (!assignments) {
                await ctx.db.delete(batch._id);
                stats.emptyBatches++;
            }
        }

        return stats;
    },
});
