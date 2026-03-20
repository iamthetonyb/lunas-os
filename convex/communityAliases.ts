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
/**
 * Deduplicate communities: merge duplicates with same normalizedName.
 * Keeps the one with a builderId (or the oldest). Updates all references.
 */
export const deduplicateCommunities = mutation({
    args: {},
    handler: async (ctx) => {
        const all = await ctx.db.query("communities").collect();
        const active = all.filter((c) => c.active !== false);

        // Group by normalized name
        const byName = new Map<string, typeof active>();
        for (const c of active) {
            const key = (c.normalizedName ?? c.name.toLowerCase().trim());
            if (!byName.has(key)) byName.set(key, []);
            byName.get(key)!.push(c);
        }

        let merged = 0;
        for (const [, dupes] of byName) {
            if (dupes.length <= 1) continue;

            // Pick the canonical one: prefer with builderId, then oldest
            dupes.sort((a, b) => {
                if (a.builderId && !b.builderId) return -1;
                if (!a.builderId && b.builderId) return 1;
                return (a.createdAt ?? 0) - (b.createdAt ?? 0);
            });
            const keep = dupes[0];
            const toRemove = dupes.slice(1);

            for (const dup of toRemove) {
                // Re-point jobRequests
                const jrs = await ctx.db.query("jobRequests")
                    .filter((q) => q.eq(q.field("communityId"), dup._id))
                    .collect();
                for (const jr of jrs) {
                    await ctx.db.patch(jr._id, { communityId: keep._id });
                }

                // Re-point blueBookEntries
                const bbs = await ctx.db.query("blueBookEntries")
                    .filter((q) => q.eq(q.field("communityId"), dup._id))
                    .collect();
                for (const bb of bbs) {
                    await ctx.db.patch(bb._id, {
                        communityId: keep._id,
                        communityName: keep.name,
                    });
                }

                // Soft-delete the duplicate
                await ctx.db.patch(dup._id, { active: false });
                merged++;
            }
        }

        return { merged, message: `Merged ${merged} duplicate communities` };
    },
});

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
