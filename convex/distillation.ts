/**
 * Distillation Pipeline — collects training data from AI decision logs
 * and conversation history for model fine-tuning.
 *
 * Inspired by:
 * - Karpathy's nanochat: pretraining → SFT → RL pipeline
 * - 0wav's curriculum learning: 3-stage (foundation → enrichment → precision)
 * - ATLAS's eval-driven improvement: T1 vs T4 distillation pairs
 *
 * The flow:
 * 1. Collect high-confidence decisions (>0.85) as "gold" training examples
 * 2. Collect conversation threads where tools were used successfully
 * 3. Export as JSONL for SFT training (nanochat chat_sft.py compatible)
 * 4. Quality-weight by confidence score (0wav curriculum approach)
 *
 * Run: pnpm tsx scripts/export-training-data.ts
 */
import { query, action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get high-confidence approved decisions as training examples.
 * These represent the AI's best work — gold standard for distillation.
 */
export const getTrainingDecisions = query({
    args: {
        minConfidence: v.optional(v.number()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const minConf = args.minConfidence ?? 0.85;
        const limit = args.limit ?? 500;

        const decisions = await ctx.db
            .query("aiDecisionLog")
            .order("desc")
            .take(limit);

        // Filter to high-confidence, non-rejected decisions
        const gold = decisions.filter(
            (d) =>
                (d.confidence ?? 0) >= minConf &&
                d.approved !== false
        );

        return gold.map((d) => ({
            action: d.action,
            input: d.input,
            output: d.output,
            confidence: d.confidence,
            source: d.source,
            createdAt: d.createdAt,
        }));
    },
});

/**
 * Get conversation threads with successful tool usage.
 * These become SFT training pairs: user message → assistant response with tool calls.
 */
export const getTrainingConversations = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 200;

        const messages = await ctx.db
            .query("aiMessages")
            .order("desc")
            .take(limit * 2); // Get more to find complete threads

        // Group by thread
        const threads: Record<string, typeof messages> = {};
        for (const msg of messages) {
            if (!threads[msg.threadId]) threads[msg.threadId] = [];
            threads[msg.threadId].push(msg);
        }

        // Convert to training format: multi-turn conversations
        const training = Object.entries(threads)
            .filter(([, msgs]) => msgs.length >= 2) // Need at least user + assistant
            .slice(0, limit)
            .map(([threadId, msgs]) => ({
                threadId,
                turns: msgs
                    .sort((a, b) => a.createdAt - b.createdAt)
                    .map((m) => ({
                        role: m.role,
                        content: m.content,
                        toolCalls: m.toolCalls
                            ? JSON.parse(m.toolCalls)
                            : undefined,
                    })),
            }));

        return training;
    },
});

/**
 * Export training data as JSONL-compatible format for nanochat SFT.
 *
 * Output format (per line):
 * {"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}], "weight": 1.0}
 *
 * Weight follows 0wav's curriculum approach:
 * - Gold (confidence > 0.95, human approved): weight 2.0
 * - High confidence (> 0.85): weight 1.5
 * - Standard: weight 1.0
 */
export const exportSFTData = action({
    args: {
        systemPrompt: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const decisions = await ctx.runQuery(
            // @ts-expect-error — types generated after deploy
            "distillation:getTrainingDecisions" as any,
            { minConfidence: 0.7, limit: 1000 }
        );

        const systemPrompt =
            args.systemPrompt ||
            "You are LUNAS AI, the operations assistant for Lunas Construction cleanup management. You help manage job scheduling, crew assignments, dispatching, and intakes.";

        const sftExamples = [];

        for (const d of decisions as any[]) {
            // Parse the input/output JSON
            let inputData, outputData;
            try {
                inputData = JSON.parse(d.input);
                outputData = JSON.parse(d.output);
            } catch {
                continue; // Skip malformed entries
            }

            // Determine quality weight (0wav curriculum style)
            let weight = 1.0;
            if (d.confidence >= 0.95) weight = 2.0; // Gold
            else if (d.confidence >= 0.85) weight = 1.5; // High confidence

            // Build SFT training example
            const userContent = buildUserPrompt(d.action, inputData);
            const assistantContent = buildAssistantResponse(
                d.action,
                outputData
            );

            if (userContent && assistantContent) {
                sftExamples.push({
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userContent },
                        { role: "assistant", content: assistantContent },
                    ],
                    weight,
                    metadata: {
                        action: d.action,
                        confidence: d.confidence,
                        source: d.source,
                        createdAt: d.createdAt,
                    },
                });
            }
        }

        return {
            count: sftExamples.length,
            examples: sftExamples,
            stats: {
                gold: sftExamples.filter((e) => e.weight >= 2.0).length,
                high: sftExamples.filter(
                    (e) => e.weight >= 1.5 && e.weight < 2.0
                ).length,
                standard: sftExamples.filter((e) => e.weight < 1.5).length,
            },
        };
    },
});

// ── Helpers ─────────────────────────────────────────────────────────

function buildUserPrompt(
    action: string,
    input: Record<string, any>
): string | null {
    switch (action) {
        case "auto_assign_foreman":
            return `Assign a foreman to the ${input.service || "job"} at ${input.community || "the community"} lot ${input.lot || ""}`;
        case "auto_assign_crew":
            return `Assign a crew to the job at ${input.community || "the community"} lot ${input.lot || ""}`;
        case "create_intake":
            return `Create a new intake for ${input.builder || "the builder"} at ${input.community || "the community"} lot ${input.lot || ""}`;
        case "reschedule":
            return `Reschedule the job to ${input.newDate || "a new date"}${input.reason ? ` because ${input.reason}` : ""}`;
        case "dispatch":
            return `Dispatch the job with foreman ${input.foremanName || ""} and crew ${input.crewName || ""} for ${input.serviceDate || "today"}`;
        case "weekly_insight_pipeline":
            return null; // System action, not user-facing
        default:
            return `Perform ${action} with context: ${JSON.stringify(input).slice(0, 200)}`;
    }
}

function buildAssistantResponse(
    action: string,
    output: Record<string, any>
): string | null {
    switch (action) {
        case "auto_assign_foreman":
            return `I've assigned ${output.foremanName || "the foreman"} to this job. ${output.reason || ""}`.trim();
        case "auto_assign_crew":
            return `Crew ${output.crewName || ""} has been assigned to this job.`;
        case "create_intake":
            return `Intake created successfully. Job ID: ${output.jobId || output.id || "assigned"}.`;
        case "reschedule":
            return `Job has been rescheduled to ${output.newDate || "the new date"}.`;
        case "dispatch":
            return `Job dispatched. Batch created for ${output.serviceDate || "today"} with ${output.foremanName || "assigned foreman"} and crew ${output.crewName || ""}.`;
        case "weekly_insight_pipeline":
            return null;
        default:
            return `Action ${action} completed: ${JSON.stringify(output).slice(0, 200)}`;
    }
}
