import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const add = internalMutation({
  args: { threadId: v.string(), role: v.string(), content: v.string(), done: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

export const patch = internalMutation({
  args: { id: v.id("messages"), content: v.string(), done: v.optional(v.boolean()) },
  handler: async (ctx, { id, content, done }) => {
    await ctx.db.patch(id, { content, ...(done !== undefined ? { done } : {}) });
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
