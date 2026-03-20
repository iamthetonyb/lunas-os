import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all OAuth accounts for a user
export const getByUser = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("oauthAccounts")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
    },
});

// Get specific provider account for a user
export const getByUserProvider = query({
    args: {
        userId: v.id("users"),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const accounts = await ctx.db
            .query("oauthAccounts")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        return accounts.find((a) => a.provider === args.provider) ?? null;
    },
});

// Upsert OAuth account — create or update token data
export const upsert = mutation({
    args: {
        userId: v.id("users"),
        provider: v.string(),
        providerAccountId: v.string(),
        accessToken: v.string(),
        refreshToken: v.optional(v.string()),
        expiresAt: v.number(),
        scope: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // Check for existing account by provider + providerAccountId
        const existing = await ctx.db
            .query("oauthAccounts")
            .withIndex("by_provider_account", (q) =>
                q.eq("provider", args.provider).eq("providerAccountId", args.providerAccountId)
            )
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                accessToken: args.accessToken,
                refreshToken: args.refreshToken ?? existing.refreshToken,
                expiresAt: args.expiresAt,
                scope: args.scope ?? existing.scope,
                updatedAt: now,
            });
            return { success: true, id: existing._id, updated: true };
        }

        const id = await ctx.db.insert("oauthAccounts", {
            userId: args.userId,
            provider: args.provider,
            providerAccountId: args.providerAccountId,
            accessToken: args.accessToken,
            refreshToken: args.refreshToken,
            expiresAt: args.expiresAt,
            scope: args.scope,
            createdAt: now,
            updatedAt: now,
        });

        return { success: true, id, updated: false };
    },
});

// Update token data (used by refresh flow)
export const updateToken = mutation({
    args: {
        userId: v.id("users"),
        provider: v.string(),
        accessToken: v.string(),
        refreshToken: v.optional(v.string()),
        expiresAt: v.number(),
    },
    handler: async (ctx, args) => {
        const accounts = await ctx.db
            .query("oauthAccounts")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        const account = accounts.find((a) => a.provider === args.provider);

        if (!account) {
            return { success: false, error: "Account not found" };
        }

        await ctx.db.patch(account._id, {
            accessToken: args.accessToken,
            refreshToken: args.refreshToken ?? account.refreshToken,
            expiresAt: args.expiresAt,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

// Remove (disconnect) an OAuth account
export const remove = mutation({
    args: {
        userId: v.id("users"),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const accounts = await ctx.db
            .query("oauthAccounts")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        const account = accounts.find((a) => a.provider === args.provider);

        if (!account) {
            return { success: false, error: "Account not found" };
        }

        await ctx.db.delete(account._id);
        return { success: true };
    },
});
