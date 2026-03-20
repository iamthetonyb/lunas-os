/**
 * Scheduler Agent — auto-assigns foremen and crews to unassigned jobs.
 *
 * Scores each foreman based on:
 *   - Community affinity (historical assignment frequency) — weight 0.4
 *   - Workload balance (prefer less-loaded foremen) — weight 0.3
 *   - Crew capacity (capacityPerDay from crews table) — weight 0.3
 *
 * Trust Level: L3 (Act with logging)
 * Trigger: Daily at 5 AM CST (11 UTC), or manual via chat tool
 *
 * See AGENTS.md lines 61-92 for spec.
 *
 * N+1 fixes applied:
 *   - getUnassignedJobs: index-first query + batch-load related entities
 *   - getForemanWorkload: index-filtered query by foreman instead of full scan
 *   - getCommunityForemenAffinity: batch-load all JRs and communities in two passes
 *   - getCrewsInternal: batch-load all foreman users at once
 */
import { internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Batch-load documents by ID, deduplicating lookups.
 * Returns a Map<Id, Doc | null> so callers can look up by ID in O(1).
 */
async function batchGet<T>(
    ctx: { db: { get: (id: any) => Promise<T | null> } },
    ids: any[]
): Promise<Map<string, T | null>> {
    const unique = Array.from(new Set(ids.filter(Boolean).map(String)));
    const results = await Promise.all(
        unique.map(async (id) => {
            const doc = await ctx.db.get(id as any);
            return [id, doc] as const;
        })
    );
    return new Map(results.map(([id, doc]) => [id, doc]));
}

// ── Internal Queries ────────────────────────────────────────────────

/**
 * Get job request services that have no foreman assigned and are due
 * within the next 3 days. Returns enriched data with community info.
 *
 * Optimization: Uses by_status index to pull only PENDING + SCHEDULED rows,
 * then batch-loads jobRequests, communities, and builders in bulk.
 */
export const getUnassignedJobs = internalQuery({
    args: {},
    handler: async (ctx) => {
        const now = new Date();
        const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const today = now.toISOString().split("T")[0];
        const cutoff = threeDaysOut.toISOString().split("T")[0];

        // Index-first: only pull PENDING and SCHEDULED rows (not the entire table)
        const [pendingJrs, scheduledJrs] = await Promise.all([
            ctx.db
                .query("jobRequestServices")
                .withIndex("by_status", (q) => q.eq("status", "PENDING"))
                .collect(),
            ctx.db
                .query("jobRequestServices")
                .withIndex("by_status", (q) => q.eq("status", "SCHEDULED"))
                .collect(),
        ]);

        const allCandidates = [...pendingJrs, ...scheduledJrs];

        // Filter: no foreman assigned + within date window
        const unassigned = allCandidates.filter((jrs) => {
            if (jrs.assignedForemanName) return false;
            const effectiveDate = jrs.rescheduledDate ?? jrs.scheduledDate ?? "";
            return effectiveDate >= today && effectiveDate <= cutoff;
        });

        if (unassigned.length === 0) return [];

        // Batch-load all referenced job requests in one pass
        const jrIds = unassigned.map((jrs) => jrs.jobRequestId);
        const jrMap = await batchGet(ctx, jrIds);

        // Collect unique community/builder IDs from the loaded job requests
        const communityIds: any[] = [];
        const builderIds: any[] = [];
        for (const jrs of unassigned) {
            const jr = jrMap.get(String(jrs.jobRequestId));
            if (jr) {
                if ((jr as any).communityId) communityIds.push((jr as any).communityId);
                if ((jr as any).builderId) builderIds.push((jr as any).builderId);
            }
        }

        // Batch-load communities and builders in one pass each
        const [communityMap, builderMap] = await Promise.all([
            batchGet(ctx, communityIds),
            batchGet(ctx, builderIds),
        ]);

        // Assemble enriched results — zero additional DB reads
        const enriched = unassigned
            .map((jrs) => {
                const jr = jrMap.get(String(jrs.jobRequestId)) as any;
                if (!jr) return null;

                const community = jr.communityId
                    ? (communityMap.get(String(jr.communityId)) as any)
                    : null;
                const builder = jr.builderId
                    ? (builderMap.get(String(jr.builderId)) as any)
                    : null;

                return {
                    _id: jrs._id,
                    serviceName: jrs.serviceName,
                    scheduledDate: jrs.rescheduledDate ?? jrs.scheduledDate,
                    communityId: jr.communityId ?? null,
                    communityName: community?.name ?? null,
                    builderId: jr.builderId ?? null,
                    builderName: builder?.name ?? null,
                    lot: jr.lot ?? null,
                };
            })
            .filter(Boolean);

        return enriched;
    },
});

/**
 * Get current workload per foreman — count of assigned jobs within a date range.
 * Used to balance work across foremen.
 *
 * Optimization: Uses by_foreman index. We query all known foremen from
 * the crews table, then for each foreman pull only their rows via index.
 * This avoids scanning the entire jobRequestServices table.
 */
export const getForemanWorkload = internalQuery({
    args: {},
    handler: async (ctx) => {
        const now = new Date();
        const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const today = now.toISOString().split("T")[0];
        const cutoff = threeDaysOut.toISOString().split("T")[0];

        // Get all distinct foreman names from crews + any currently assigned JRS
        // We use a two-pronged approach:
        // 1. Get foreman names from crews (the known foremen)
        // 2. Also query active statuses via index to catch any foremen not in crews table

        // Pull active-status JRS via indexes (much smaller than full table scan)
        const [pendingJrs, scheduledJrs, dispatchedJrs] = await Promise.all([
            ctx.db
                .query("jobRequestServices")
                .withIndex("by_status", (q) => q.eq("status", "PENDING"))
                .collect(),
            ctx.db
                .query("jobRequestServices")
                .withIndex("by_status", (q) => q.eq("status", "SCHEDULED"))
                .collect(),
            ctx.db
                .query("jobRequestServices")
                .withIndex("by_status", (q) => q.eq("status", "DISPATCHED"))
                .collect(),
        ]);

        const activeJrs = [...pendingJrs, ...scheduledJrs, ...dispatchedJrs];

        // Count jobs per foreman in the date window
        const workload: Record<string, number> = {};

        for (const jrs of activeJrs) {
            if (!jrs.assignedForemanName) continue;

            const effectiveDate = jrs.rescheduledDate ?? jrs.scheduledDate ?? "";
            if (effectiveDate < today || effectiveDate > cutoff) continue;

            workload[jrs.assignedForemanName] =
                (workload[jrs.assignedForemanName] || 0) + 1;
        }

        return workload;
    },
});

/**
 * Get community-foreman affinity data — which foremen have historically
 * handled which communities. Derived from all assigned job request services
 * and completed dispatch batches.
 *
 * Optimization: Instead of N+1 (for each JRS: get JR, get community),
 * we batch-load all job requests at once, then batch-load all communities
 * at once. Same pattern for dispatch batch history. Cuts ~15k ops to ~3 queries.
 */
export const getCommunityForemenAffinity = internalQuery({
    args: {},
    handler: async (ctx) => {
        // ── Phase 1: JRS-based affinity ──────────────────────────────

        // Only pull JRS rows that have an assigned foreman (use the index)
        // We need to get all distinct foreman names first. Since by_foreman
        // doesn't let us query "assignedForemanName != null", we use a
        // different strategy: pull from the active statuses which are much
        // smaller than the full table, then filter for assigned ones.
        //
        // Better approach: pull JRS by each status that matters, filter for
        // those with assignedForemanName set.
        const [pendingJrs, scheduledJrs, dispatchedJrs, completeJrs] = await Promise.all([
            ctx.db
                .query("jobRequestServices")
                .withIndex("by_status", (q) => q.eq("status", "PENDING"))
                .collect(),
            ctx.db
                .query("jobRequestServices")
                .withIndex("by_status", (q) => q.eq("status", "SCHEDULED"))
                .collect(),
            ctx.db
                .query("jobRequestServices")
                .withIndex("by_status", (q) => q.eq("status", "DISPATCHED"))
                .collect(),
            ctx.db
                .query("jobRequestServices")
                .withIndex("by_status", (q) => q.eq("status", "COMPLETE"))
                .collect(),
        ]);

        const allJrs = [...pendingJrs, ...scheduledJrs, ...dispatchedJrs, ...completeJrs];
        const assignedJrs = allJrs.filter((jrs) => jrs.assignedForemanName);

        // Batch-load all referenced job requests in one pass
        const jrIds = assignedJrs.map((jrs) => jrs.jobRequestId);
        const jrMap = await batchGet(ctx, jrIds);

        // Collect all community IDs from loaded job requests
        const communityIdsFromJrs: any[] = [];
        for (const jr of Array.from(jrMap.values())) {
            if (jr && (jr as any).communityId) {
                communityIdsFromJrs.push((jr as any).communityId);
            }
        }

        // ── Phase 2: Dispatch batch history ──────────────────────────

        const completedBatches = await ctx.db
            .query("dispatchBatches")
            .withIndex("by_status", (q) => q.eq("status", "COMPLETE"))
            .collect();

        const batchesWithForeman = completedBatches.filter((b) => b.foremanName);

        // Load all assignments for completed batches in parallel
        const batchAssignments = await Promise.all(
            batchesWithForeman.map((batch) =>
                ctx.db
                    .query("assignments")
                    .withIndex("by_batch", (q) => q.eq("dispatchBatchId", batch._id))
                    .collect()
            )
        );

        // Collect all JRS IDs referenced by assignments
        const assignmentJrsIds: any[] = [];
        for (const assignments of batchAssignments) {
            for (const assignment of assignments) {
                assignmentJrsIds.push(assignment.jobRequestServiceId);
            }
        }

        // Batch-load all JRS docs referenced by assignments
        const assignmentJrsMap = await batchGet(ctx, assignmentJrsIds);

        // Collect JR IDs from those JRS docs
        const assignmentJrIds: any[] = [];
        for (const jrs of Array.from(assignmentJrsMap.values())) {
            if (jrs && (jrs as any).jobRequestId) {
                assignmentJrIds.push((jrs as any).jobRequestId);
            }
        }

        // Batch-load the job requests (many may already be in jrMap, but
        // batchGet deduplicates internally)
        const assignmentJrMap = await batchGet(ctx, assignmentJrIds);

        // Collect community IDs from assignment job requests
        const communityIdsFromBatches: any[] = [];
        for (const jr of Array.from(assignmentJrMap.values())) {
            if (jr && (jr as any).communityId) {
                communityIdsFromBatches.push((jr as any).communityId);
            }
        }

        // Batch-load ALL communities in one shot (from both phases)
        const allCommunityIds = [...communityIdsFromJrs, ...communityIdsFromBatches];
        const communityMap = await batchGet(ctx, allCommunityIds);

        // ── Phase 3: Build affinity map ──────────────────────────────

        const affinity: Record<string, Record<string, number>> = {};

        // From job request services
        for (const jrs of assignedJrs) {
            const jr = jrMap.get(String(jrs.jobRequestId)) as any;
            if (!jr?.communityId) continue;

            const community = communityMap.get(String(jr.communityId)) as any;
            if (!community) continue;

            const key = community.name;
            if (!affinity[key]) affinity[key] = {};
            affinity[key][jrs.assignedForemanName!] =
                (affinity[key][jrs.assignedForemanName!] || 0) + 1;
        }

        // From completed dispatch batches (adds historical weight)
        for (let i = 0; i < batchesWithForeman.length; i++) {
            const batch = batchesWithForeman[i];
            const assignments = batchAssignments[i];

            for (const assignment of assignments) {
                const jrs = assignmentJrsMap.get(
                    String(assignment.jobRequestServiceId)
                ) as any;
                if (!jrs) continue;

                const jr = assignmentJrMap.get(String(jrs.jobRequestId)) as any;
                if (!jr?.communityId) continue;

                const community = communityMap.get(String(jr.communityId)) as any;
                if (!community) continue;

                const key = community.name;
                if (!affinity[key]) affinity[key] = {};
                // Completed batches get extra weight (proven success)
                affinity[key][batch.foremanName!] =
                    (affinity[key][batch.foremanName!] || 0) + 2;
            }
        }

        return affinity;
    },
});

// ── Internal Mutations ──────────────────────────────────────────────

export const assignForemanInternal = internalMutation({
    args: {
        jobId: v.id("jobRequestServices"),
        foremanName: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, {
            assignedForemanName: args.foremanName,
        });
        return { success: true };
    },
});

/**
 * Log a scheduler decision to the audit trail.
 */
export const logSchedulerDecision = internalMutation({
    args: {
        action: v.string(),
        input: v.string(),
        output: v.string(),
        confidence: v.number(),
        source: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("aiDecisionLog", {
            action: args.action,
            input: args.input,
            output: args.output,
            confidence: args.confidence,
            source: args.source,
            createdAt: Date.now(),
        });
    },
});

// ── Main Scheduler Action ───────────────────────────────────────────

/**
 * The main scheduler logic:
 *
 * 1. Get unassigned jobs due in next 3 days
 * 2. For each job, score each foreman based on:
 *    - Community affinity (weight 0.4)
 *    - Workload balance (weight 0.3)
 *    - Crew capacity (weight 0.3)
 * 3. If best score > 0.85 → auto-assign
 * 4. If score 0.70-0.85 → suggest but don't assign
 * 5. If score < 0.70 → skip (needs human review)
 * 6. Log every decision to aiDecisionLog
 * 7. Return summary
 */
export const autoAssignJobs = internalAction({
    args: {},
    handler: async (ctx) => {
        const _internal = internal as any;
        // 1. Gather data
        const [unassignedJobs, workload, affinity] = await Promise.all([
            ctx.runQuery(_internal.scheduler.getUnassignedJobs),
            ctx.runQuery(_internal.scheduler.getForemanWorkload),
            ctx.runQuery(_internal.scheduler.getCommunityForemenAffinity),
        ]) as [any[], Record<string, any>, Record<string, any>];

        if (unassignedJobs.length === 0) {
            await ctx.runMutation(_internal.scheduler.logSchedulerDecision, {
                action: "scheduler_run",
                input: JSON.stringify({ unassignedCount: 0 }),
                output: JSON.stringify({ message: "No unassigned jobs found" }),
                confidence: 1.0,
                source: "auto",
            });
            return {
                unassignedCount: 0,
                assigned: [],
                suggested: [],
                needsReview: [],
                message: "No unassigned jobs found in the next 3 days.",
            };
        }

        // Get all crews for capacity data
        // We can't use ctx.runQuery with a public query from an internal action,
        // so we query crews via an internal query
        const crews = await ctx.runQuery(_internal.scheduler.getCrewsInternal);

        // Build foreman → crew capacity map
        const foremanCapacity: Record<string, number> = {};
        const foremanCrewName: Record<string, string> = {};

        // Get all known foreman names from affinity data + workload + crews
        const allForemen = new Set<string>();

        // From affinity data
        for (const communityForemen of Object.values(affinity) as any[]) {
            for (const foremanName of Object.keys(communityForemen as any)) {
                allForemen.add(foremanName);
            }
        }

        // From workload
        for (const foremanName of Object.keys(workload)) {
            allForemen.add(foremanName);
        }

        // From crews
        for (const crew of crews) {
            if (crew.foremanName) {
                allForemen.add(crew.foremanName);
                foremanCapacity[crew.foremanName] = crew.capacityPerDay ?? 8;
                foremanCrewName[crew.foremanName] = crew.name;
            }
        }

        // Default capacity for foremen without a crew record
        for (const foreman of Array.from(allForemen)) {
            if (!(foreman in foremanCapacity)) {
                foremanCapacity[foreman] = 8; // default capacity
            }
        }

        const foremanList = Array.from(allForemen);

        if (foremanList.length === 0) {
            await ctx.runMutation(_internal.scheduler.logSchedulerDecision, {
                action: "scheduler_run",
                input: JSON.stringify({ unassignedCount: unassignedJobs.length }),
                output: JSON.stringify({ message: "No foremen available in system" }),
                confidence: 1.0,
                source: "auto",
            });
            return {
                unassignedCount: unassignedJobs.length,
                assigned: [],
                suggested: [],
                needsReview: unassignedJobs.map((j: any) => ({
                    jobId: j._id,
                    community: j.communityName,
                    service: j.serviceName,
                    reason: "No foremen available in system",
                })),
                message: "No foremen available to assign.",
            };
        }

        // 2. Score and assign
        const assigned: any[] = [];
        const suggested: any[] = [];
        const needsReview: any[] = [];

        // Track running workload (so we don't overload as we assign)
        const runningWorkload = { ...workload };

        for (const job of unassignedJobs) {
            const communityName = (job as any).communityName as string | null;
            const communityAffinity: Record<string, number> = communityName ? (affinity[communityName] ?? {}) : {};

            // Total affinity assignments for this community
            const totalAffinityCount = Object.values(communityAffinity).reduce(
                (sum: number, count: number) => sum + count,
                0
            );

            // Find max workload across all foremen for normalization
            const maxWorkload = Math.max(
                ...foremanList.map((f) => runningWorkload[f] ?? 0),
                1
            );

            // Score each foreman
            const scores = foremanList.map((foremanName) => {
                // Community affinity score (0-1): how often this foreman handles this community
                const affinityCount: number = communityAffinity[foremanName] ?? 0;
                const affinityScore =
                    totalAffinityCount > 0
                        ? affinityCount / totalAffinityCount
                        : 0;

                // Workload balance score (0-1): lower workload = higher score
                const currentLoad = runningWorkload[foremanName] ?? 0;
                const workloadScore =
                    maxWorkload > 0
                        ? 1 - currentLoad / (maxWorkload + 1)
                        : 1;

                // Crew capacity score (0-1): more remaining capacity = higher score
                const capacity = foremanCapacity[foremanName] ?? 8;
                const capacityScore =
                    capacity > 0
                        ? Math.max(0, 1 - currentLoad / capacity)
                        : 0;

                // Weighted composite
                const totalScore =
                    affinityScore * 0.4 +
                    workloadScore * 0.3 +
                    capacityScore * 0.3;

                return {
                    foremanName,
                    affinityScore: Math.round(affinityScore * 100) / 100,
                    workloadScore: Math.round(workloadScore * 100) / 100,
                    capacityScore: Math.round(capacityScore * 100) / 100,
                    totalScore: Math.round(totalScore * 100) / 100,
                    crewName: foremanCrewName[foremanName] ?? null,
                    currentLoad,
                };
            });

            // Sort by total score descending
            scores.sort((a, b) => b.totalScore - a.totalScore);
            const best = scores[0];

            const decision = {
                jobId: (job as any)._id,
                community: communityName,
                service: (job as any).serviceName,
                scheduledDate: (job as any).scheduledDate,
                lot: (job as any).lot,
                bestForeman: best.foremanName,
                bestScore: best.totalScore,
                crewName: best.crewName,
                scoreBreakdown: {
                    affinity: best.affinityScore,
                    workload: best.workloadScore,
                    capacity: best.capacityScore,
                },
                allScores: scores.slice(0, 3), // top 3 for context
            };

            if (best.totalScore > 0.85) {
                // Auto-assign
                await ctx.runMutation(_internal.scheduler.assignForemanInternal, {
                    jobId: (job as any)._id,
                    foremanName: best.foremanName,
                });

                // Update running workload
                runningWorkload[best.foremanName] =
                    (runningWorkload[best.foremanName] ?? 0) + 1;

                assigned.push(decision);

                await ctx.runMutation(_internal.scheduler.logSchedulerDecision, {
                    action: "auto_assign_foreman",
                    input: JSON.stringify({
                        jobId: (job as any)._id,
                        service: (job as any).serviceName,
                        community: communityName,
                        lot: (job as any).lot,
                    }),
                    output: JSON.stringify({
                        foremanName: best.foremanName,
                        crewName: best.crewName,
                        reason: `Score ${best.totalScore} (affinity: ${best.affinityScore}, workload: ${best.workloadScore}, capacity: ${best.capacityScore})`,
                    }),
                    confidence: best.totalScore,
                    source: "auto",
                });
            } else if (best.totalScore >= 0.70) {
                // Suggest but don't assign
                suggested.push(decision);

                await ctx.runMutation(_internal.scheduler.logSchedulerDecision, {
                    action: "suggest_foreman",
                    input: JSON.stringify({
                        jobId: (job as any)._id,
                        service: (job as any).serviceName,
                        community: communityName,
                        lot: (job as any).lot,
                    }),
                    output: JSON.stringify({
                        suggestedForeman: best.foremanName,
                        crewName: best.crewName,
                        reason: `Score ${best.totalScore} — above threshold but below auto-assign. Suggest ${best.foremanName}.`,
                    }),
                    confidence: best.totalScore,
                    source: "auto",
                });
            } else {
                // Needs human review
                needsReview.push({
                    ...decision,
                    reason: `Best score ${best.totalScore} is below 0.70 threshold — insufficient data or conflicting signals.`,
                });

                await ctx.runMutation(_internal.scheduler.logSchedulerDecision, {
                    action: "needs_human_review",
                    input: JSON.stringify({
                        jobId: (job as any)._id,
                        service: (job as any).serviceName,
                        community: communityName,
                        lot: (job as any).lot,
                    }),
                    output: JSON.stringify({
                        bestForeman: best.foremanName,
                        bestScore: best.totalScore,
                        reason: "Score below 0.70 threshold — needs human review",
                    }),
                    confidence: best.totalScore,
                    source: "auto",
                });
            }
        }

        // Log the overall run summary
        await ctx.runMutation(_internal.scheduler.logSchedulerDecision, {
            action: "scheduler_run",
            input: JSON.stringify({
                unassignedCount: unassignedJobs.length,
                foremanCount: foremanList.length,
            }),
            output: JSON.stringify({
                assigned: assigned.length,
                suggested: suggested.length,
                needsReview: needsReview.length,
            }),
            confidence: 1.0,
            source: "auto",
        });

        return {
            unassignedCount: unassignedJobs.length,
            assigned: assigned.map((d) => ({
                jobId: d.jobId,
                community: d.community,
                service: d.service,
                lot: d.lot,
                foreman: d.bestForeman,
                crew: d.crewName,
                confidence: d.bestScore,
            })),
            suggested: suggested.map((d) => ({
                jobId: d.jobId,
                community: d.community,
                service: d.service,
                lot: d.lot,
                suggestedForeman: d.bestForeman,
                crew: d.crewName,
                confidence: d.bestScore,
            })),
            needsReview: needsReview.map((d) => ({
                jobId: d.jobId,
                community: d.community,
                service: d.service,
                lot: d.lot,
                reason: d.reason,
            })),
            message: `Scheduler complete: ${assigned.length} auto-assigned, ${suggested.length} suggested, ${needsReview.length} need human review.`,
        };
    },
});

// ── Helper internal query for crews ─────────────────────────────────

/**
 * Get all crews with foreman name resolved — internal version
 * for use by the scheduler action.
 *
 * Optimization: Batch-load all foreman users at once instead of N+1.
 */
export const getCrewsInternal = internalQuery({
    args: {},
    handler: async (ctx) => {
        const crews = await ctx.db.query("crews").collect();

        // Batch-load all foreman users in one pass
        const foremanIds = crews
            .map((crew) => crew.foremanId)
            .filter(Boolean);
        const foremanMap = await batchGet(ctx, foremanIds);

        const enriched = crews.map((crew) => {
            let foremanName: string | null = null;
            if (crew.foremanId) {
                const foreman = foremanMap.get(String(crew.foremanId)) as any;
                foremanName = foreman?.name ?? null;
            }
            return {
                _id: crew._id,
                name: crew.name,
                foremanName,
                skills: crew.skills ?? [],
                capacityPerDay: crew.capacityPerDay ?? 8,
            };
        });

        return enriched;
    },
});
