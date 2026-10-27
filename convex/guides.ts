import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

async function ownedSession(
	ctx: {
		auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
		db: any;
	},
	sessionId: any
) {
	const identity = await ctx.auth.getUserIdentity();
	const session = await ctx.db.get(sessionId);
	if (!(identity && session) || session.userId !== identity.subject) {
		throw new Error("Session not found");
	}
	return session;
}

export const resolveChat = query({
	args: { chatId: v.string() },
	handler: async (ctx, { chatId }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthenticated");
		}
		let session: Doc<"sessions"> | null = null;
		try {
			session = await ctx.db.get(chatId as Id<"sessions">);
		} catch {
			/* Check the chat key below. */
		}
		if (!session) {
			session = await ctx.db
				.query("sessions")
				.withIndex("by_chat_key", (q) => q.eq("chatKey", chatId))
				.first();
		}
		if (!session || session.userId !== identity.subject) {
			throw new Error("Session not found");
		}
		return session._id;
	},
});

export const listResults = query({
	args: { sessionId: v.id("sessions"), toolCallId: v.string() },
	handler: async (ctx, { sessionId, toolCallId }) => {
		await ownedSession(ctx, sessionId);
		const rows = await ctx.db
			.query("guide_step_results")
			.withIndex("by_tool_call", (q) => q.eq("toolCallId", toolCallId))
			.collect();
		return rows
			.filter((row) => row.sessionId === sessionId)
			.sort((a, b) => a.createdAt - b.createdAt);
	},
});

export const findResult = query({
	args: {
		sessionId: v.id("sessions"),
		toolCallId: v.string(),
		stepId: v.string(),
	},
	handler: async (ctx, { sessionId, toolCallId, stepId }) => {
		await ownedSession(ctx, sessionId);
		const row = await ctx.db
			.query("guide_step_results")
			.withIndex("by_tool_step", (q) =>
				q.eq("toolCallId", toolCallId).eq("stepId", stepId)
			)
			.first();
		return row?.sessionId === sessionId ? row : null;
	},
});

export const saveResult = mutation({
	args: {
		chatId: v.string(),
		toolCallId: v.string(),
		stepId: v.string(),
		outcome: v.string(),
		pastedOutputFull: v.optional(v.string()),
		pastedOutputForModel: v.optional(v.string()),
		note: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthenticated");
		let session: Doc<"sessions"> | null = null;
		try {
			session = await ctx.db.get(args.chatId as Id<"sessions">);
		} catch {
			/* Check the chat key below. */
		}
		if (!session) {
			session = await ctx.db
				.query("sessions")
				.withIndex("by_chat_key", (q) => q.eq("chatKey", args.chatId))
				.first();
		}
		if (!session || session.userId !== identity.subject) {
			throw new Error("Session not found");
		}
		const sessionId = session._id;
		const existing = await ctx.db
			.query("guide_step_results")
			.withIndex("by_tool_step", (q) =>
				q.eq("toolCallId", args.toolCallId).eq("stepId", args.stepId)
			)
			.first();
		if (existing) {
			if (existing.sessionId !== sessionId) {
				throw new Error("Tool call belongs to another session");
			}
			return existing;
		}
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_session_sequence", (q) =>
				q.eq("sessionId", sessionId)
			)
			.collect();
		const issued = messages.some((message) =>
			message.parts.some(
				(part: { type?: string; toolCallId?: string; toolName?: string }) =>
					(part.type === "tool-guide_steps" || (part.type === "dynamic-tool" && part.toolName === "guide_steps")) &&
					part.toolCallId === args.toolCallId
			)
		);
		if (!issued) {
			throw new Error("Guide call not found in this session");
		}
		const createdAt = Date.now();
		const id = await ctx.db.insert("guide_step_results", {
			sessionId,
			toolCallId: args.toolCallId,
			stepId: args.stepId,
			outcome: args.outcome,
			pastedOutputFull: args.pastedOutputFull,
			pastedOutputForModel: args.pastedOutputForModel,
			note: args.note,
			createdAt,
		});
		await ctx.db.patch(sessionId, { updatedAt: createdAt });
		const saved = await ctx.db.get(id);
		if (!saved) {
			throw new Error("Unable to load saved guide result");
		}
		return saved;
	},
});
