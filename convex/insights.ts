/**
 * Insight Agent — analyzes completed jobs, detects patterns, ingests into RAG.
 *
 * Runs on a schedule (weekly) or can be triggered manually via action call.
 * This is the "learning loop" from AGENTS.md — the system gets smarter
 * with every completed batch.
 */
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ── Internal Queries (used by insight actions) ──────────────────────

/**
 * Get completed job services from the last N days with related data.
 */
export const getCompletedJobsInternal = internalQuery({
    args: { lastDays: v.number() },
    handler: async (ctx, { lastDays }) => {
        const cutoff = Date.now() - lastDays * 24 * 60 * 60 * 1000;

        // Get job request services that are COMPLETE
        const completed = await ctx.db
            .query("jobRequestServices")
            .withIndex("by_status", (q) => q.eq("status", "COMPLETE"))
            .collect();

        // Filter to recent
        const recent = completed.filter((j) => j.createdAt >= cutoff);

        // Enrich with job request + community + builder info
        const enriched = await Promise.all(
            recent.map(async (jrs) => {
                const jr = await ctx.db.get(jrs.jobRequestId);
                if (!jr) return null;

                const community = jr.communityId
                    ? await ctx.db.get(jr.communityId)
                    : null;
                const builder = jr.builderId
                    ? await ctx.db.get(jr.builderId)
                    : null;

                return {
                    serviceName: jrs.serviceName,
                    foremanName: jrs.assignedForemanName,
                    crewName: jrs.assignedCrewName,
                    communityName: community?.name,
                    builderName: builder?.name,
                    lot: jr.lot,
                    scheduledDate: jrs.scheduledDate,
                    status: jrs.status,
                };
            })
        );

        return enriched.filter(Boolean);
    },
});

/**
 * Get foreman assignment frequency by community.
 */
export const getForemanAffinities = internalQuery({
    args: {},
    handler: async (ctx) => {
        const allJrs = await ctx.db
            .query("jobRequestServices")
            .collect();

        // Count foreman assignments per community
        const affinities: Record<string, Record<string, number>> = {};

        for (const jrs of allJrs) {
            if (!jrs.assignedForemanName) continue;

            const jr = await ctx.db.get(jrs.jobRequestId);
            if (!jr?.communityId) continue;

            const community = await ctx.db.get(jr.communityId);
            if (!community) continue;

            const key = community.name;
            if (!affinities[key]) affinities[key] = {};
            affinities[key][jrs.assignedForemanName] =
                (affinities[key][jrs.assignedForemanName] || 0) + 1;
        }

        // Convert to sorted list with percentages
        const results = Object.entries(affinities).map(
            ([community, foremen]) => {
                const total = Object.values(foremen).reduce((a, b) => a + b, 0);
                const sorted = Object.entries(foremen)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count]) => ({
                        name,
                        count,
                        pct: Math.round((count / total) * 100),
                    }));
                return { community, total, foremen: sorted };
            }
        );

        return results.sort((a, b) => b.total - a.total);
    },
});

/**
 * Get service frequency by community — what services are ordered most.
 */
export const getServicePatterns = internalQuery({
    args: {},
    handler: async (ctx) => {
        const allJrs = await ctx.db
            .query("jobRequestServices")
            .collect();

        const patterns: Record<string, Record<string, number>> = {};

        for (const jrs of allJrs) {
            if (!jrs.serviceName) continue;

            const jr = await ctx.db.get(jrs.jobRequestId);
            if (!jr?.communityId) continue;

            const community = await ctx.db.get(jr.communityId);
            if (!community) continue;

            const key = community.name;
            if (!patterns[key]) patterns[key] = {};
            patterns[key][jrs.serviceName] =
                (patterns[key][jrs.serviceName] || 0) + 1;
        }

        return Object.entries(patterns).map(([community, services]) => {
            const total = Object.values(services).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(services)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => ({
                    name,
                    count,
                    pct: Math.round((count / total) * 100),
                }));
            return { community, total, services: sorted };
        });
    },
});

// ── Insight Actions ─────────────────────────────────────────────────

/**
 * Analyze foreman-community affinities and ingest patterns into RAG.
 */
export const analyzeForemanPatterns = action({
    args: {},
    handler: async (ctx) => {
        const affinities = await ctx.runQuery(
            internal.insights.getForemanAffinities
        );

        const insights: string[] = [];

        for (const { community, foremen } of affinities) {
            if (foremen.length === 0) continue;

            const top = foremen[0];
            if (top.pct >= 60) {
                insights.push(
                    `Community assignment pattern: ${top.name} handles ${top.pct}% of ${community} jobs (${top.count} total). Default to ${top.name} for new ${community} work.`
                );
            }

            if (foremen.length > 1) {
                const backup = foremen[1];
                insights.push(
                    `Backup foreman for ${community}: ${backup.name} (${backup.pct}% of jobs). Use when ${top.name} is at capacity.`
                );
            }
        }

        return { count: insights.length, insights };
    },
});

/**
 * Analyze service ordering patterns per community.
 */
export const analyzeServicePatterns = action({
    args: {},
    handler: async (ctx) => {
        const patterns = await ctx.runQuery(
            internal.insights.getServicePatterns
        );

        const insights: string[] = [];

        for (const { community, services, total } of patterns) {
            if (total < 3) continue; // Need enough data

            const topServices = services.slice(0, 3).map((s: { name: string; count: number; pct: number }) => s.name);
            insights.push(
                `Service demand for ${community}: Top services are ${topServices.join(", ")} (${total} total jobs). Plan crew skills accordingly.`
            );
        }

        return { count: insights.length, insights };
    },
});

/**
 * Full weekly insight pipeline — runs all analyses and ingests into RAG.
 */
export const runWeeklyInsights = action({
    args: {},
    handler: async (ctx) => {
        // 1. Analyze foreman patterns
        const foremanInsights = await ctx.runAction(
            internal.insights.analyzeForemanPatterns
        );

        // 2. Analyze service patterns
        const serviceInsights = await ctx.runAction(
            internal.insights.analyzeServicePatterns
        );

        // 3. Run evolution analysis (confidence calibration)
        const evolution = await ctx.runAction(
            internal.insights.analyzeEvolution
        );

        // 4. Ingest all insights into RAG
        const allInsights = [
            ...foremanInsights.insights,
            ...serviceInsights.insights,
            ...evolution.insights,
        ];

        for (const text of allInsights) {
            await ctx.runAction(internal.insights.ingestInsight, {
                text,
                namespace: "operations",
            });
        }

        // 5. Log the learning event
        await ctx.runMutation(internal.insights.logInsightRun, {
            foremanCount: foremanInsights.count,
            serviceCount: serviceInsights.count,
            totalIngested: allInsights.length,
        });

        return {
            foremanInsights: foremanInsights.count,
            serviceInsights: serviceInsights.count,
            evolutionInsights: evolution.insights.length,
            totalIngested: allInsights.length,
        };
    },
});

// ── Internal helpers ────────────────────────────────────────────────

import { internalAction, internalMutation } from "./_generated/server";
import { components } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";

const rag = new RAG(components.rag, {
    textEmbeddingModel: openai.embedding("text-embedding-3-small"),
    embeddingDimension: 1536,
});

export const ingestInsight = internalAction({
    args: { text: v.string(), namespace: v.string() },
    handler: async (ctx, { text, namespace }) => {
        await rag.add(ctx, { namespace, text });
    },
});

export const logInsightRun = internalMutation({
    args: {
        foremanCount: v.number(),
        serviceCount: v.number(),
        totalIngested: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("aiDecisionLog", {
            action: "weekly_insight_pipeline",
            input: JSON.stringify({
                foremanPatterns: args.foremanCount,
                servicePatterns: args.serviceCount,
            }),
            output: JSON.stringify({
                totalIngested: args.totalIngested,
            }),
            confidence: 1.0,
            source: "scheduled",
            createdAt: Date.now(),
        });
    },
});

// ── Evolution Engine (modeled after ATLAS daemon) ───────────────────
// Analyzes decision logs to track acceptance rates and detect under/over-routing.
// Produces evolution insights that feed back into the knowledge base.

/**
 * Analyze AI decision logs for patterns — which actions succeed,
 * which get overridden, and where confidence calibration is off.
 */
export const getDecisionMetrics = internalQuery({
    args: {},
    handler: async (ctx) => {
        const decisions = await ctx.db
            .query("aiDecisionLog")
            .order("desc")
            .take(200);

        // Group by action type
        const byAction: Record<
            string,
            { total: number; approved: number; avgConfidence: number }
        > = {};

        for (const d of decisions) {
            if (!byAction[d.action]) {
                byAction[d.action] = { total: 0, approved: 0, avgConfidence: 0 };
            }
            const entry = byAction[d.action];
            entry.total++;
            if (d.approved !== false) entry.approved++;
            entry.avgConfidence += d.confidence ?? 0;
        }

        // Calculate averages
        const metrics = Object.entries(byAction).map(([action, data]) => ({
            action,
            total: data.total,
            approved: data.approved,
            rejected: data.total - data.approved,
            approvalRate: Math.round((data.approved / data.total) * 100),
            avgConfidence: Math.round(
                (data.avgConfidence / data.total) * 100
            ) / 100,
        }));

        return metrics.sort((a, b) => b.total - a.total);
    },
});

/**
 * Evolution analysis — detects miscalibrated confidence and generates
 * corrective insights for the knowledge base.
 */
export const analyzeEvolution = action({
    args: {},
    handler: async (ctx) => {
        const metrics = await ctx.runQuery(
            internal.insights.getDecisionMetrics
        );

        const insights: string[] = [];

        for (const m of metrics) {
            if (m.total < 5) continue; // Need sufficient data

            // Under-confident: high approval but low avg confidence
            if (m.approvalRate > 90 && m.avgConfidence < 0.8) {
                insights.push(
                    `Evolution: ${m.action} has ${m.approvalRate}% approval rate but avg confidence is only ${m.avgConfidence}. The AI is under-confident — safe to raise auto-execute threshold for this action type.`
                );
            }

            // Over-confident: low approval but high avg confidence
            if (m.approvalRate < 70 && m.avgConfidence > 0.8) {
                insights.push(
                    `Evolution: ${m.action} has only ${m.approvalRate}% approval rate despite avg confidence of ${m.avgConfidence}. The AI is over-confident — lower auto-execute threshold and require human review for this action type.`
                );
            }

            // Consistently rejected: something is wrong
            if (m.rejected > 3 && m.approvalRate < 50) {
                insights.push(
                    `Evolution WARNING: ${m.action} is rejected ${m.rejected}/${m.total} times (${100 - m.approvalRate}% rejection). Disable auto-execution for this action until retrained.`
                );
            }
        }

        return { metrics, insights };
    },
});
