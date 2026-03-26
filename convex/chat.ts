import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Queries ─────────────────────────────────────────────────────────

/** List conversations the current user belongs to, sorted by most recent message. */
export const listConversations = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const memberships = await ctx.db
            .query("conversationMembers")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        const convos = await Promise.all(
            memberships.map(async (m) => {
                const conv = await ctx.db.get(m.conversationId);
                if (!conv) return null;

                // Get other members for DM display name
                const members = await ctx.db
                    .query("conversationMembers")
                    .withIndex("by_conversation", (q) => q.eq("conversationId", m.conversationId))
                    .collect();

                const memberUsers = await Promise.all(
                    members.map(async (mem) => {
                        const u = await ctx.db.get(mem.userId);
                        return u ? { id: u._id, name: u.name ?? u.email, lastReadAt: mem.lastReadAt } : null;
                    })
                );

                // Count unread messages
                const lastRead = m.lastReadAt ?? 0;
                const unreadMessages = await ctx.db
                    .query("messages")
                    .withIndex("by_conversation", (q) => q.eq("conversationId", m.conversationId))
                    .filter((q) => q.gt(q.field("createdAt"), lastRead))
                    .collect();

                return {
                    ...conv,
                    members: memberUsers.filter(Boolean),
                    unreadCount: unreadMessages.length,
                    myLastReadAt: m.lastReadAt,
                };
            })
        );

        return convos
            .filter(Boolean)
            .sort((a, b) => (b!.lastMessageAt ?? 0) - (a!.lastMessageAt ?? 0));
    },
});

/** Get messages for a conversation (most recent first, paginated).
 *  Respects visibleFrom — members added later only see history from their allowed timestamp. */
export const getMessages = query({
    args: {
        conversationId: v.id("conversations"),
        userId: v.optional(v.id("users")),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 100;

        // Check if this member has a visibleFrom restriction
        let visibleFrom: number | undefined;
        if (args.userId) {
            const membership = await ctx.db
                .query("conversationMembers")
                .withIndex("by_user_conversation", (q) =>
                    q.eq("userId", args.userId!).eq("conversationId", args.conversationId)
                )
                .first();
            visibleFrom = membership?.visibleFrom ?? undefined;
        }

        let messages = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .order("desc")
            .take(limit);

        // Filter by visibleFrom if set
        if (visibleFrom) {
            messages = messages.filter((m) => m.createdAt >= visibleFrom!);
        }

        return messages.reverse(); // chronological order
    },
});

/** Get conversation members. */
export const getMembers = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const members = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        return Promise.all(
            members.map(async (m) => {
                const u = await ctx.db.get(m.userId);
                return {
                    membershipId: m._id,
                    userId: m.userId,
                    name: u?.name ?? u?.email ?? "Unknown",
                    email: u?.email,
                    role: u?.role,
                    joinedAt: m.joinedAt,
                };
            })
        );
    },
});

// ── Mutations ───────────────────────────────────────────────────────

/** Create a direct message conversation between two users. Returns existing if one exists. */
export const createDirect = mutation({
    args: {
        userId: v.id("users"),
        otherUserId: v.id("users"),
    },
    handler: async (ctx, args) => {
        // Check if DM already exists between these two users
        const myMemberships = await ctx.db
            .query("conversationMembers")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        for (const m of myMemberships) {
            const conv = await ctx.db.get(m.conversationId);
            if (conv?.type !== "direct") continue;

            const otherMember = await ctx.db
                .query("conversationMembers")
                .withIndex("by_user_conversation", (q) =>
                    q.eq("userId", args.otherUserId).eq("conversationId", m.conversationId)
                )
                .first();

            if (otherMember) return { conversationId: m.conversationId, created: false };
        }

        // Create new DM
        const now = Date.now();
        const convId = await ctx.db.insert("conversations", {
            type: "direct",
            createdBy: args.userId,
            createdAt: now,
        });

        await ctx.db.insert("conversationMembers", {
            conversationId: convId,
            userId: args.userId,
            joinedAt: now,
        });
        await ctx.db.insert("conversationMembers", {
            conversationId: convId,
            userId: args.otherUserId,
            joinedAt: now,
        });

        return { conversationId: convId, created: true };
    },
});

/** Create a group conversation. */
export const createGroup = mutation({
    args: {
        creatorId: v.id("users"),
        name: v.string(),
        memberIds: v.array(v.id("users")),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const convId = await ctx.db.insert("conversations", {
            type: "group",
            name: args.name.trim(),
            createdBy: args.creatorId,
            createdAt: now,
        });

        // Add creator + all members
        const allMembers = new Set([args.creatorId, ...args.memberIds]);
        for (const uid of allMembers) {
            await ctx.db.insert("conversationMembers", {
                conversationId: convId,
                userId: uid,
                joinedAt: now,
            });
        }

        return { conversationId: convId };
    },
});

/** Send a message in a conversation. Creates notifications for other members. */
export const sendMessage = mutation({
    args: {
        conversationId: v.id("conversations"),
        senderId: v.id("users"),
        body: v.string(),
    },
    handler: async (ctx, args) => {
        const sender = await ctx.db.get(args.senderId);
        const senderName = sender?.name ?? sender?.email ?? "Unknown";
        const now = Date.now();
        const preview = args.body.length > 80 ? args.body.slice(0, 80) + "..." : args.body;

        // Insert message
        const msgId = await ctx.db.insert("messages", {
            conversationId: args.conversationId,
            senderId: args.senderId,
            senderName,
            body: args.body.trim(),
            createdAt: now,
        });

        // Update conversation's last message
        await ctx.db.patch(args.conversationId, {
            lastMessageAt: now,
            lastMessagePreview: preview,
        });

        // Mark as read for sender
        const senderMembership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_user_conversation", (q) =>
                q.eq("userId", args.senderId).eq("conversationId", args.conversationId)
            )
            .first();
        if (senderMembership) {
            await ctx.db.patch(senderMembership._id, { lastReadAt: now });
        }

        // Create notifications for other members
        const members = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        const conv = await ctx.db.get(args.conversationId);

        for (const m of members) {
            if (m.userId === args.senderId) continue;
            await ctx.db.insert("notifications", {
                userId: m.userId,
                type: "message",
                title: conv?.type === "group" ? `${senderName} in ${conv?.name ?? "Group"}` : senderName,
                body: preview,
                relatedId: args.conversationId,
                relatedType: "conversation",
                conversationId: args.conversationId,
                read: false,
                createdAt: now,
            });
        }

        return { messageId: msgId };
    },
});

/** Mark a conversation as read for a user. */
export const markRead = mutation({
    args: {
        conversationId: v.id("conversations"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const membership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_user_conversation", (q) =>
                q.eq("userId", args.userId).eq("conversationId", args.conversationId)
            )
            .first();
        if (membership) {
            await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
        }

        // Also mark message notifications for this conversation as read
        const notifs = await ctx.db
            .query("notifications")
            .withIndex("by_user_read", (q) => q.eq("userId", args.userId).eq("read", false))
            .collect();

        for (const n of notifs) {
            if (n.conversationId === args.conversationId && n.type === "message") {
                await ctx.db.patch(n._id, { read: true });
            }
        }

        return { success: true };
    },
});

/** Update group conversation name. */
export const updateGroupName = mutation({
    args: {
        conversationId: v.id("conversations"),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const conv = await ctx.db.get(args.conversationId);
        if (!conv || conv.type !== "group") {
            throw new Error("Not a group conversation");
        }
        await ctx.db.patch(args.conversationId, { name: args.name.trim() });
        return { success: true };
    },
});

/** Add a member to a group conversation with optional history visibility control.
 *  historyAccess: "all" = see everything, "from_now" = only messages after joining,
 *  or a timestamp for custom cutoff. */
export const addMember = mutation({
    args: {
        conversationId: v.id("conversations"),
        userId: v.id("users"),
        historyAccess: v.optional(v.union(
            v.literal("all"),
            v.literal("from_now"),
            v.number(), // custom timestamp
        )),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("conversationMembers")
            .withIndex("by_user_conversation", (q) =>
                q.eq("userId", args.userId).eq("conversationId", args.conversationId)
            )
            .first();
        if (existing) return { success: true, alreadyMember: true };

        const now = Date.now();
        let visibleFrom: number | undefined;

        if (args.historyAccess === "from_now") {
            visibleFrom = now;
        } else if (typeof args.historyAccess === "number") {
            visibleFrom = args.historyAccess;
        }
        // "all" or undefined → visibleFrom stays undefined → can see all history

        await ctx.db.insert("conversationMembers", {
            conversationId: args.conversationId,
            userId: args.userId,
            joinedAt: now,
            visibleFrom,
        });

        // Create a system notification for the new member
        const conv = await ctx.db.get(args.conversationId);
        const user = await ctx.db.get(args.userId);
        if (conv && user) {
            await ctx.db.insert("notifications", {
                userId: args.userId,
                type: "system",
                title: `Added to group: ${conv.name ?? "Group"}`,
                body: `You were added to a group conversation`,
                relatedId: args.conversationId,
                relatedType: "conversation",
                conversationId: args.conversationId,
                read: false,
                createdAt: now,
            });
        }

        return { success: true, alreadyMember: false };
    },
});

/** Remove a member from a group conversation. */
export const removeMember = mutation({
    args: {
        conversationId: v.id("conversations"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const membership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_user_conversation", (q) =>
                q.eq("userId", args.userId).eq("conversationId", args.conversationId)
            )
            .first();
        if (membership) {
            await ctx.db.delete(membership._id);
        }
        return { success: true };
    },
});
