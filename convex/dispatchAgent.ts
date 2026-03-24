/**
 * Dispatch Agent — auto-batches assigned jobs into dispatch batches.
 *
 * Runs daily at 6 AM CST (12 UTC), one hour after the Scheduler Agent.
 * Groups today's assigned (but not yet dispatched) jobs by crew,
 * creates batch records, and flags anomalies.
 *
 * Trust Level: L3 (Act with logging)
 * See AGENTS.md lines 96-111 for spec.
 */
import { internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ── Internal Queries ────────────────────────────────────────────────

/**
 * Get jobs that are assigned (have foreman + crew) but not yet dispatched.
 * Targets today and tomorrow.
 */
export const getReadyToDispatch = internalQuery({
    args: {},
    handler: async (ctx) => {
        const now = new Date();
        const today = now.toISOString().split("T")[0];
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];

        // Index-first: query by scheduledDate for today + tomorrow
        const [todayJrs, tomorrowJrs] = await Promise.all([
            ctx.db.query("jobRequestServices")
                .withIndex("by_scheduledDate", (q) => q.eq("scheduledDate", today))
                .take(2000),
            ctx.db.query("jobRequestServices")
                .withIndex("by_scheduledDate", (q) => q.eq("scheduledDate", tomorrow))
                .take(2000),
        ]);

        const allJrs = [...todayJrs, ...tomorrowJrs];

        const ready = allJrs.filter((jrs) => {
            if (!jrs.assignedForemanName || !jrs.assignedCrewName) return false;
            if (jrs.status === "DISPATCHED" || jrs.status === "COMPLETE") return false;
            const date = jrs.rescheduledDate ?? jrs.scheduledDate ?? "";
            return date === today || date === tomorrow;
        });

        // Batch-load: collect unique jobRequestIds, fetch all at once, build map
        const jobRequestIds = [...new Set(ready.map((jrs) => jrs.jobRequestId))];
        const jobRequests = await Promise.all(jobRequestIds.map((id) => ctx.db.get(id)));
        const jrMap = new Map(
            jobRequestIds.map((id, i) => [id, jobRequests[i]])
        );

        // Batch-load: collect unique communityIds from fetched job requests, fetch all at once
        const communityIds = [
            ...new Set(
                jobRequests
                    .filter((jr) => jr?.communityId)
                    .map((jr) => jr!.communityId!)
            ),
        ];
        const communities = await Promise.all(communityIds.map((id) => ctx.db.get(id)));
        const communityMap = new Map(
            communityIds.map((id, i) => [id, communities[i]])
        );

        // Enrich using maps — no additional DB calls
        const enriched = ready
            .map((jrs) => {
                const jr = jrMap.get(jrs.jobRequestId);
                if (!jr) return null;

                const community = jr.communityId
                    ? communityMap.get(jr.communityId) ?? null
                    : null;

                return {
                    _id: jrs._id,
                    serviceName: jrs.serviceName,
                    foremanName: jrs.assignedForemanName!,
                    crewName: jrs.assignedCrewName!,
                    scheduledDate: jrs.rescheduledDate ?? jrs.scheduledDate ?? today,
                    communityName: community?.name ?? null,
                    lot: jr.lot ?? null,
                    address: jr.address ?? null,
                    jobRequestId: jrs.jobRequestId,
                };
            })
            .filter(Boolean);

        return enriched;
    },
});

/**
 * Check for anomalies: double-booked lots (same lot, same date, different jobs).
 */
export const detectAnomalies = internalQuery({
    args: {},
    handler: async (ctx) => {
        const now = new Date();
        const today = now.toISOString().split("T")[0];

        // Index-first: query today's scheduled jobs only
        const todayScheduled = await ctx.db
            .query("jobRequestServices")
            .withIndex("by_scheduledDate", (q) => q.eq("scheduledDate", today))
            .take(5000);

        const todayJobs = todayScheduled.filter((jrs) => jrs.status !== "COMPLETE");

        // Batch-load: collect unique jobRequestIds, fetch all at once, build map
        const jobRequestIds = [...new Set(todayJobs.map((jrs) => jrs.jobRequestId))];
        const jobRequests = await Promise.all(jobRequestIds.map((id) => ctx.db.get(id)));
        const jrMap = new Map(
            jobRequestIds.map((id, i) => [id, jobRequests[i]])
        );

        // Batch-load: collect unique communityIds from fetched job requests, fetch all at once
        const communityIds = [
            ...new Set(
                jobRequests
                    .filter((jr) => jr?.communityId)
                    .map((jr) => jr!.communityId!)
            ),
        ];
        const communities = await Promise.all(communityIds.map((id) => ctx.db.get(id)));
        const communityMap = new Map(
            communityIds.map((id, i) => [id, communities[i]])
        );

        // Check for duplicate lots using maps — no additional DB calls
        const lotMap: Record<string, any[]> = {};
        for (const jrs of todayJobs) {
            const jr = jrMap.get(jrs.jobRequestId);
            if (!jr?.lot) continue;

            const community = jr.communityId
                ? communityMap.get(jr.communityId) ?? null
                : null;

            const key = `${community?.name ?? "unknown"}-${jr.lot}`;
            if (!lotMap[key]) lotMap[key] = [];
            lotMap[key].push({
                jobId: jrs._id,
                service: jrs.serviceName,
                foreman: jrs.assignedForemanName,
                crew: jrs.assignedCrewName,
            });
        }

        const anomalies = Object.entries(lotMap)
            .filter(([, jobs]) => jobs.length > 1)
            .map(([lot, jobs]) => ({
                type: "double_booked_lot",
                lot,
                jobCount: jobs.length,
                jobs,
            }));

        return anomalies;
    },
});

// ── Internal Mutations ──────────────────────────────────────────────

export const createBatchWithAssignments = internalMutation({
    args: {
        foremanName: v.string(),
        crewName: v.string(),
        serviceDate: v.string(),
        jobIds: v.array(v.id("jobRequestServices")),
    },
    handler: async (ctx, args) => {
        // Create the dispatch batch
        const batchId = await ctx.db.insert("dispatchBatches", {
            serviceDate: args.serviceDate,
            status: "SENT",
            crewName: args.crewName,
            foremanName: args.foremanName,
            createdAt: Date.now(),
        });

        // Create assignments and update job statuses
        for (const jobId of args.jobIds) {
            await ctx.db.insert("assignments", {
                jobRequestServiceId: jobId,
                dispatchBatchId: batchId,
                status: "SENT",
                createdAt: Date.now(),
            });

            await ctx.db.patch(jobId, {
                status: "DISPATCHED",
            });
        }

        return { batchId, jobCount: args.jobIds.length };
    },
});

export const logDispatchDecision = internalMutation({
    args: {
        action: v.string(),
        input: v.string(),
        output: v.string(),
        confidence: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("aiDecisionLog", {
            action: args.action,
            input: args.input,
            output: args.output,
            confidence: args.confidence,
            source: "scheduled",
            createdAt: Date.now(),
        });
    },
});

// ── Main Dispatch Action ────────────────────────────────────────────

/**
 * Auto-dispatch: group ready jobs by crew+date, create batches, flag anomalies.
 */
export const autoDispatch = internalAction({
    args: {},
    handler: async (ctx) => {
        const _internal = internal as any;
        // 1. Get ready jobs
        const readyJobs: any[] = await ctx.runQuery(
            _internal.dispatchAgent.getReadyToDispatch
        );

        if (readyJobs.length === 0) {
            await ctx.runMutation(_internal.dispatchAgent.logDispatchDecision, {
                action: "dispatch_run",
                input: JSON.stringify({ readyCount: 0 }),
                output: JSON.stringify({ message: "No jobs ready to dispatch" }),
                confidence: 1.0,
            });
            return {
                dispatched: 0,
                batches: [],
                anomalies: [],
                message: "No jobs ready to dispatch.",
            };
        }

        // 2. Detect anomalies
        const anomalies: any[] = await ctx.runQuery(
            _internal.dispatchAgent.detectAnomalies
        );

        // 3. Group by crew + date
        const groups: Record<
            string,
            { foremanName: string; crewName: string; date: string; jobIds: any[] }
        > = {};

        for (const job of readyJobs) {
            const key = `${(job as any).crewName}|${(job as any).scheduledDate}`;
            if (!groups[key]) {
                groups[key] = {
                    foremanName: (job as any).foremanName,
                    crewName: (job as any).crewName,
                    date: (job as any).scheduledDate,
                    jobIds: [],
                };
            }
            groups[key].jobIds.push((job as any)._id);
        }

        // 4. Create dispatch batches
        const batches: any[] = [];
        for (const group of Object.values(groups)) {
            const result: any = await ctx.runMutation(
                _internal.dispatchAgent.createBatchWithAssignments,
                {
                    foremanName: group.foremanName,
                    crewName: group.crewName,
                    serviceDate: group.date,
                    jobIds: group.jobIds,
                }
            );
            batches.push({
                ...result,
                foremanName: group.foremanName,
                crewName: group.crewName,
                date: group.date,
            });
        }

        // 5. Log the dispatch run
        await ctx.runMutation(_internal.dispatchAgent.logDispatchDecision, {
            action: "auto_dispatch",
            input: JSON.stringify({
                readyCount: readyJobs.length,
                groupCount: batches.length,
                anomalyCount: anomalies.length,
            }),
            output: JSON.stringify({
                batchesCreated: batches.length,
                jobsDispatched: readyJobs.length,
                anomalies: anomalies.length > 0 ? anomalies : "none",
            }),
            confidence: 1.0,
        });

        return {
            dispatched: readyJobs.length,
            batches: batches.map((b) => ({
                batchId: b.batchId,
                crew: b.crewName,
                foreman: b.foremanName,
                date: b.date,
                jobs: b.jobCount,
            })),
            anomalies,
            message: `Dispatched ${readyJobs.length} jobs in ${batches.length} batches.${anomalies.length > 0 ? ` WARNING: ${anomalies.length} anomalies detected.` : ""}`,
        };
    },
});
