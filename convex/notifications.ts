import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ── Queries ─────────────────────────────────────────────────────────

/** Get notifications for a user, most recent first. */
export const list = query({
    args: {
        userId: v.id("users"),
        filter: v.optional(v.string()), // "all" | "unread" | "messages" | "system"
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 50;
        const filter = args.filter ?? "all";

        let notifs;
        if (filter === "unread") {
            notifs = await ctx.db
                .query("notifications")
                .withIndex("by_user_read", (q) => q.eq("userId", args.userId).eq("read", false))
                .order("desc")
                .take(limit);
        } else {
            notifs = await ctx.db
                .query("notifications")
                .withIndex("by_user_createdAt", (q) => q.eq("userId", args.userId))
                .order("desc")
                .take(limit);
        }

        // Apply type filter client-side for "messages" / "system"
        if (filter === "messages") {
            notifs = notifs.filter((n) => n.type === "message");
        } else if (filter === "system") {
            notifs = notifs.filter((n) => n.type !== "message");
        }

        return notifs;
    },
});

/** Get unread notification count for badge display. */
export const unreadCount = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const unread = await ctx.db
            .query("notifications")
            .withIndex("by_user_read", (q) => q.eq("userId", args.userId).eq("read", false))
            .take(101); // cap at 101 to detect "100+"
        return unread.length;
    },
});

// ── Mutations ───────────────────────────────────────────────────────

/** Create a notification for a user. */
export const create = mutation({
    args: {
        userId: v.id("users"),
        type: v.string(),
        title: v.string(),
        body: v.optional(v.string()),
        relatedId: v.optional(v.string()),
        relatedType: v.optional(v.string()),
        conversationId: v.optional(v.id("conversations")),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("notifications", {
            userId: args.userId,
            type: args.type,
            title: args.title,
            body: args.body,
            relatedId: args.relatedId,
            relatedType: args.relatedType,
            conversationId: args.conversationId,
            read: false,
            createdAt: Date.now(),
        });
        return { id };
    },
});

/** Mark a single notification as read. */
export const markRead = mutation({
    args: { id: v.id("notifications") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { read: true });
        return { success: true };
    },
});

/** Mark all notifications as read for a user. */
export const markAllRead = mutation({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const unread = await ctx.db
            .query("notifications")
            .withIndex("by_user_read", (q) => q.eq("userId", args.userId).eq("read", false))
            .collect();

        for (const n of unread) {
            await ctx.db.patch(n._id, { read: true });
        }
        return { count: unread.length };
    },
});

/** Delete a single notification. */
export const remove = mutation({
    args: { id: v.id("notifications") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return { success: true };
    },
});

// ── Internal: 90-day purge (called by cron) ─────────────────────────

export const purgeOld = internalMutation({
    args: {},
    handler: async (ctx) => {
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const old = await ctx.db
            .query("notifications")
            .withIndex("by_createdAt")
            .filter((q) => q.lt(q.field("createdAt"), ninetyDaysAgo))
            .take(500); // batch to avoid timeout

        for (const n of old) {
            await ctx.db.delete(n._id);
        }
        return { deleted: old.length };
    },
});
