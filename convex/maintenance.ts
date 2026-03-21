/**
 * Maintenance tasks — scheduled cleanup of soft-deleted records.
 * Runs monthly via cron to keep the database lean and prevent
 * soft-deleted (active=false) master data from cluttering queries.
 *
 * Blue Book entries are retained for 2 years minimum (tax records).
 */
import { internalMutation } from "./_generated/server";

export const purgeStaleRecords = internalMutation({
    handler: async (ctx) => {
        const cutoff90 = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days
        const cutoff2yr = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000; // 2 years
        const stats = {
            builders: 0,
            communities: 0,
            services: 0,
            modelPlans: 0,
            contractRates: 0,
            emptyBatches: 0,
            blueBookEntries: 0,
        };

        // 1. Purge soft-deleted builders (active=false, older than 90 days)
        const builders = await ctx.db.query("builders").collect();
        for (const b of builders) {
            if (b.active === false && b._creationTime < cutoff90) {
                await ctx.db.delete(b._id);
                stats.builders++;
            }
        }

        // 2. Purge soft-deleted communities
        const communities = await ctx.db.query("communities").collect();
        for (const c of communities) {
            if (c.active === false && c._creationTime < cutoff90) {
                await ctx.db.delete(c._id);
                stats.communities++;
            }
        }

        // 3. Purge soft-deleted services
        const services = await ctx.db.query("services").collect();
        for (const s of services) {
            if (s.active === false && s._creationTime < cutoff90) {
                await ctx.db.delete(s._id);
                stats.services++;
            }
        }

        // 4. Purge soft-deleted model plans
        const modelPlans = await ctx.db.query("modelPlans").collect();
        for (const mp of modelPlans) {
            if (mp.active === false && mp._creationTime < cutoff90) {
                await ctx.db.delete(mp._id);
                stats.modelPlans++;
            }
        }

        // 5. Purge soft-deleted contract rates
        const rates = await ctx.db.query("contractRates").collect();
        for (const r of rates) {
            if ((r as any).active === false && r._creationTime < cutoff90) {
                await ctx.db.delete(r._id);
                stats.contractRates++;
            }
        }

        // 6. Clean up empty dispatch batches older than 90 days
        const batches = await ctx.db.query("dispatchBatches").collect();
        for (const batch of batches) {
            if (batch._creationTime > cutoff90) continue;
            const assignment = await ctx.db
                .query("assignments")
                .withIndex("by_batch", (q) => q.eq("dispatchBatchId", batch._id))
                .first();
            if (!assignment) {
                await ctx.db.delete(batch._id);
                stats.emptyBatches++;
            }
        }

        // 7. Purge blue book entries older than 2 YEARS only
        // These are tax records — must be retained for at least 2 years
        const blueBookEntries = await ctx.db.query("blueBookEntries").collect();
        for (const bb of blueBookEntries) {
            if (bb._creationTime < cutoff2yr && bb.status === "COMPLETE") {
                await ctx.db.delete(bb._id);
                stats.blueBookEntries++;
            }
        }

        return stats;
    },
});
