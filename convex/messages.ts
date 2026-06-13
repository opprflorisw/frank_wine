import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const add = internalMutation({
  args: { threadId: v.string(), role: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", args);
  },
});

export const listByThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    return msgs.slice(-40);
  },
});

export const clear = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);
  },
});
