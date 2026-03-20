import { query } from "./_generated/server";
import { v } from "convex/values";

export const byCommunity = query({
    args: { communityId: v.id("communities") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("communityLots")
            .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
            .collect();
    },
});
