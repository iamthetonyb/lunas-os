/**
 * Community Aliases — maps scraped name variants to canonical community records.
 * Three-layer resolution on ingestion:
 * 1. Normalize raw name → check communityAliases.by_alias
 * 2. Fuzzy match against communities.normalizedName
 * 3. Flag unresolved for admin with "needs mapping" badge
 */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Queries ─────────────────────────────────────────────────────────

export const getByAlias = query({
    args: { alias: v.string() },
    handler: async (ctx, args) => {
        const normalized = args.alias.toLowerCase().trim();
        return await ctx.db
            .query("communityAliases")
            .withIndex("by_alias", (q) => q.eq("alias", normalized))
            .first();
    },
});

export const getByCommunity = query({
    args: { communityId: v.id("communities") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("communityAliases")
            .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
            .collect();
    },
});

export const listAll = query({
    handler: async (ctx) => {
        const aliases = await ctx.db.query("communityAliases").collect();

        // Batch-load community names
        const communityIds = [...new Set(aliases.map((a) => a.communityId))];
        const communities = await Promise.all(communityIds.map((id) => ctx.db.get(id)));
        const communityMap = new Map(communities.filter(Boolean).map((c) => [c!._id, c!]));

        return aliases.map((a) => ({
            ...a,
            id: a._id,
            communityName: communityMap.get(a.communityId)?.name ?? "Unknown",
        }));
    },
});

// ── Mutations ───────────────────────────────────────────────────────

export const create = mutation({
    args: {
        alias: v.string(),
        communityId: v.id("communities"),
        builderId: v.optional(v.id("builders")),
    },
    handler: async (ctx, args) => {
        const normalized = args.alias.toLowerCase().trim();

        // Check for duplicate
        const existing = await ctx.db
            .query("communityAliases")
            .withIndex("by_alias", (q) => q.eq("alias", normalized))
            .first();
        if (existing) {
            throw new Error(`Alias "${normalized}" already exists`);
        }

        const id = await ctx.db.insert("communityAliases", {
            alias: normalized,
            communityId: args.communityId,
            builderId: args.builderId,
            createdAt: Date.now(),
        });
        return { id };
    },
});

export const remove = mutation({
    args: { id: v.id("communityAliases") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return { success: true };
    },
});

// ── Resolution ──────────────────────────────────────────────────────

/**
 * Resolve a raw community name to a canonical community ID.
 * Returns: { communityId, method } or { unresolved: true }
 */
export const resolve = query({
    args: { rawName: v.string() },
    handler: async (ctx, args) => {
        const normalized = args.rawName.toLowerCase().trim();

        // Layer 1: Exact alias match
        const alias = await ctx.db
            .query("communityAliases")
            .withIndex("by_alias", (q) => q.eq("alias", normalized))
            .first();
        if (alias) {
            return { communityId: alias.communityId, method: "alias" as const };
        }

        // Layer 2: Exact normalizedName match on communities table
        const exactMatch = await ctx.db
            .query("communities")
            .withIndex("by_normalizedName", (q) => q.eq("normalizedName", normalized))
            .first();
        if (exactMatch) {
            return { communityId: exactMatch._id, method: "exact" as const };
        }

        // Layer 3: Fuzzy — check if normalized name is contained in or contains a community name
        const allCommunities = await ctx.db.query("communities").collect();
        const active = allCommunities.filter((c) => c.active !== false);

        for (const community of active) {
            const commNorm = (community.normalizedName ?? community.name.toLowerCase().trim());
            if (commNorm.includes(normalized) || normalized.includes(commNorm)) {
                return { communityId: community._id, method: "fuzzy" as const };
            }
        }

        // Layer 4: Unresolved
        return { unresolved: true as const, rawName: args.rawName };
    },
});

/**
 * Backfill: resolve + create alias for future lookups.
 */
export const resolveAndAlias = mutation({
    args: {
        rawName: v.string(),
        communityId: v.id("communities"),
        builderId: v.optional(v.id("builders")),
    },
    handler: async (ctx, args) => {
        const normalized = args.rawName.toLowerCase().trim();

        // Check if alias already exists
        const existing = await ctx.db
            .query("communityAliases")
            .withIndex("by_alias", (q) => q.eq("alias", normalized))
            .first();
        if (existing) return { id: existing._id };

        const id = await ctx.db.insert("communityAliases", {
            alias: normalized,
            communityId: args.communityId,
            builderId: args.builderId,
            createdAt: Date.now(),
        });
        return { id };
    },
});
