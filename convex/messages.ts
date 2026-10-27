import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

async function requireUserId(ctx: {
	auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Unauthenticated");
	}
	return identity.subject;
}

export const list = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, { sessionId }) => {
		const userId = await requireUserId(ctx);
		const session = await ctx.db.get(sessionId);
		if (!session || session.userId !== userId) {
			return [];
		}
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_session_sequence", (q) => q.eq("sessionId", sessionId))
			.order("asc")
			.collect();
		const byMessageId = new Map(messages.map((message) => [message.messageId, message]));
		return [...byMessageId.values()].map(({ messageId, role, parts, metadata, createdAt }) => ({
			id: messageId,
			role,
			parts,
			metadata,
			createdAt,
		}));
	},
});

export const getChat = query({
	args: { chatId: v.string() },
	handler: async (ctx, { chatId }) => {
		const userId = await requireUserId(ctx);
		let session: Doc<"sessions"> | null = null;
		try {
			session = await ctx.db.get(chatId as Id<"sessions">);
		} catch {
			// New chat URLs use the client chat key instead of a Convex document ID.
		}
		if (!session) {
			session = await ctx.db
				.query("sessions")
				.withIndex("by_chat_key", (q) => q.eq("chatKey", chatId))
				.first();
		}
		if (!session || session.userId !== userId) return null;
		const storedMessages = await ctx.db
			.query("messages")
			.withIndex("by_session_sequence", (q) => q.eq("sessionId", session._id))
			.order("asc")
			.collect();
		const messages = [...new Map(storedMessages.map((message) => [message.messageId, message])).values()];
		return {
			title: session.title,
			messages: messages.map(({ messageId, role, parts, metadata, createdAt }) => ({
				id: messageId,
				role,
				parts,
				metadata,
				createdAt,
			})),
		};
	},
});

export const append = mutation({
	args: {
		sessionId: v.id("sessions"),
		id: v.string(),
		role: v.union(
			v.literal("user"),
			v.literal("assistant"),
			v.literal("system")
		),
		parts: v.array(v.any()),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, { sessionId, id: messageId, role, parts, metadata }) => {
		const userId = await requireUserId(ctx);
		const session = await ctx.db.get(sessionId);
		if (!session || session.userId !== userId) {
			throw new Error("Session not found");
		}
		const matches = await ctx.db
			.query("messages")
			.withIndex("by_session_message", (q) =>
				q.eq("sessionId", sessionId).eq("messageId", messageId)
			)
			.collect();
		const existing = matches[0];
		if (existing) {
			await ctx.db.patch(existing._id, { role, parts, metadata });
			for (const duplicate of matches.slice(1)) await ctx.db.delete(duplicate._id);
			const updatedAt = Date.now();
			await ctx.db.patch(sessionId, { updatedAt });
			return existing._id;
		}
		const lastMessage = await ctx.db
			.query("messages")
			.withIndex("by_session_sequence", (q) => q.eq("sessionId", sessionId))
			.order("desc")
			.first();
		const createdAt = Date.now();
		const sequence = (lastMessage?.sequence ?? 0) + 1;
		const dbId = await ctx.db.insert("messages", {
			sessionId,
			messageId,
			role,
			parts,
			metadata,
			sequence,
			createdAt,
		});
		await ctx.db.patch(sessionId, { updatedAt: createdAt });
		return dbId;
	},
});
