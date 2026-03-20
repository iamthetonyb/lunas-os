/**
 * AI-related Convex functions:
 * - RAG knowledge base (ingest + search)
 * - Decision logging for autonomous actions
 * - AI message persistence
 */
import { action, mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";

// ── RAG Setup ────────────────────────────────────────────────────────
const rag = new RAG(components.rag, {
    textEmbeddingModel: openai.embedding("text-embedding-3-small"),
    embeddingDimension: 1536,
});

// ── RAG Knowledge Base ───────────────────────────────────────────────

export const ingestKnowledge = action({
    args: {
        text: v.string(),
        namespace: v.optional(v.string()),
    },
    handler: async (ctx, { text, namespace }) => {
        await rag.add(ctx, {
            namespace: namespace ?? "operations",
            text,
        });
        return { success: true };
    },
});

export const searchKnowledge = action({
    args: {
        query: v.string(),
        namespace: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const result = await rag.search(ctx, {
            namespace: args.namespace ?? "operations",
            query: args.query,
            limit: args.limit ?? 8,
        });
        return {
            text: result.text,
            count: result.results.length,
        };
    },
});

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
