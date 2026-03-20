/**
 * AI-related Convex functions:
 * - Decision logging for autonomous actions
 * - AI message persistence
 *
 * RAG setup: Once convex.config.ts is deployed and types regenerated,
 * uncomment the RAG imports and functions below.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── RAG Setup (enable after `npx convex dev` regenerates types) ──────
// import { components } from "./_generated/api";
// import { RAG } from "@convex-dev/rag";
// import { openai } from "@ai-sdk/openai";
//
// const rag = new RAG(components.rag, {
//     textEmbeddingModel: openai.embedding("text-embedding-3-small"),
//     embeddingDimension: 1536,
// });

// ── Decision Logging ─────────────────────────────────────────────────

export const logDecision = mutation({
    args: {
        action: v.string(),
        input: v.string(),
        output: v.string(),
        confidence: v.optional(v.number()),
        source: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("aiDecisionLog", {
            action: args.action,
            input: args.input,
            output: args.output,
            confidence: args.confidence,
            source: args.source ?? "chat",
            createdAt: Date.now(),
        });
        return { id };
    },
});

export const getRecentDecisions = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const decisions = await ctx.db
            .query("aiDecisionLog")
            .order("desc")
            .take(args.limit ?? 20);
        return decisions;
    },
});

// ── AI Message Persistence ───────────────────────────────────────────

export const saveMessage = mutation({
    args: {
        threadId: v.string(),
        userId: v.optional(v.id("users")),
        role: v.string(),
        content: v.string(),
        toolCalls: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("aiMessages", {
            ...args,
            createdAt: Date.now(),
        });
        return { id };
    },
});

export const getThreadMessages = query({
    args: { threadId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("aiMessages")
            .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
            .collect();
    },
});
