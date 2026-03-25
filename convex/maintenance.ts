/**
 * Maintenance tasks — scheduled cleanup of stale, soft-deleted, and expired records.
 * Runs monthly via cron to keep the database lean.
 *
 * Retention policies:
 *   - Soft-deleted master data (builders/communities/services/plans): 90 days
 *   - Blue Book entries (COMPLETE only): 2 years (tax records)
 *   - Empty dispatch batches: 90 days
 *   - AI messages: 6 months
 *   - AI decision log: 6 months
 *   - Import raw data: 90 days (metadata kept forever)
 *   - Foreman affinity cache: 60 days (rebuilt weekly)
 */
import { internalMutation } from "./_generated/server";

// Max records to process per table per run to stay within Convex limits
const BATCH_LIMIT = 2000;

export const purgeStaleRecords = internalMutation({
    handler: async (ctx) => {
        const cutoff90 = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const cutoff6mo = Date.now() - 180 * 24 * 60 * 60 * 1000;
        const cutoff60 = Date.now() - 60 * 24 * 60 * 60 * 1000;
        const cutoff2yr = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;

        const stats = {
            builders: 0,
            communities: 0,
            services: 0,
            modelPlans: 0,
            contractRates: 0,
            emptyBatches: 0,
            blueBookEntries: 0,
            aiMessages: 0,
            aiDecisionLog: 0,
            importRawData: 0,
            affinityCache: 0,
        };

        // 1. Purge soft-deleted master data (bounded scan, filter in memory)
        const tables = [
            { table: "builders" as const, key: "builders" as const },
            { table: "communities" as const, key: "communities" as const },
            { table: "services" as const, key: "services" as const },
            { table: "modelPlans" as const, key: "modelPlans" as const },
        ];

        for (const { table, key } of tables) {
            const records = await ctx.db.query(table).take(BATCH_LIMIT);
            for (const r of records) {
                if ((r as any).active === false && r._creationTime < cutoff90) {
                    await ctx.db.delete(r._id);
                    stats[key]++;
                }
            }
        }

        // 2. Soft-deleted contract rates
        const rates = await ctx.db.query("contractRates").take(BATCH_LIMIT);
        for (const r of rates) {
            if ((r as any).active === false && r._creationTime < cutoff90) {
                await ctx.db.delete(r._id);
                stats.contractRates++;
            }
        }

        // 3. Empty dispatch batches > 90 days
        const batches = await ctx.db.query("dispatchBatches").take(BATCH_LIMIT);
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

        // 4. Blue Book entries > 2 years (COMPLETE only — tax retention)
        const blueBook = await ctx.db
            .query("blueBookEntries")
            .withIndex("by_status", (q) => q.eq("status", "COMPLETE"))
            .take(BATCH_LIMIT);
        for (const bb of blueBook) {
            if (bb._creationTime < cutoff2yr) {
                await ctx.db.delete(bb._id);
                stats.blueBookEntries++;
            }
        }

        // 5. AI messages > 6 months
        const oldMessages = await ctx.db
            .query("aiMessages")
            .take(BATCH_LIMIT);
        for (const msg of oldMessages) {
            if (msg.createdAt < cutoff6mo) {
                await ctx.db.delete(msg._id);
                stats.aiMessages++;
            }
        }

        // 6. AI decision log > 6 months
        const oldDecisions = await ctx.db
            .query("aiDecisionLog")
            .withIndex("by_createdAt")
            .take(BATCH_LIMIT);
        for (const d of oldDecisions) {
            if (d.createdAt < cutoff6mo) {
                await ctx.db.delete(d._id);
                stats.aiDecisionLog++;
            }
        }

        // 7a. Soft-deleted imports > 90 days → hard delete with cascade
        const deletedImports = await ctx.db
            .query("importHistory")
            .withIndex("by_deletedAt")
            .take(BATCH_LIMIT);
        for (const imp of deletedImports) {
            if (imp.deletedAt && imp.deletedAt < cutoff90) {
                // Cascade: delete linked entities
                const linked = await ctx.db
                    .query("importedEntities")
                    .withIndex("by_import", (q) => q.eq("importId", imp._id))
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
                await ctx.db.delete(imp._id);
                stats.importRawData++;
            }
        }

        // 7b. Active imports > 90 days — strip raw data (keep metadata)
        const oldImports = await ctx.db
            .query("importHistory")
            .withIndex("by_createdAt")
            .take(BATCH_LIMIT);
        for (const imp of oldImports) {
            if (!imp.deletedAt && imp.createdAt < cutoff90 && (imp.rawRows || imp.parsedRows)) {
                await ctx.db.patch(imp._id, {
                    rawRows: undefined,
                    parsedRows: undefined,
                });
            }
        }

        // 8. Foreman affinity cache > 60 days (rebuilt weekly, old entries stale)
        const oldCache = await ctx.db
            .query("foremanAffinityCache")
            .take(BATCH_LIMIT);
        for (const c of oldCache) {
            if (c.computedAt < cutoff60) {
                await ctx.db.delete(c._id);
                stats.affinityCache++;
            }
        }

        return stats;
    },
});
