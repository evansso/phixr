import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { buildResult, formatQuestionnaireAnswers, formatQuestionnaireSkipped, questionnaireAnswerMessageId } from "../src/lib/questionnaire/result";
import { questionnaireInput, type AnswerInput, type ToolOutput } from "../src/lib/questionnaire/schema";

async function ownedSession(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> }; db: any }, sessionId: any) {
	const identity = await ctx.auth.getUserIdentity();
	const session = await ctx.db.get(sessionId);
	if (!identity || !session || session.userId !== identity.subject) throw new Error("Session not found");
	return session;
}

export const countForSession = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, { sessionId }) => {
		await ownedSession(ctx, sessionId);
		const messages = await ctx.db.query("messages").withIndex("by_session_sequence", (q) => q.eq("sessionId", sessionId)).collect();
		const calls = new Set<string>();
		for (const message of messages) for (const part of message.parts as Array<{ type?: string; toolCallId?: string }>) if (part.type === "tool-askUserQuestionnaire" && part.toolCallId) calls.add(part.toolCallId);
		return calls.size;
	},
});

export const resolveChat = query({
	args: { chatId: v.string() },
	handler: async (ctx, { chatId }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthenticated");
		let session: Doc<"sessions"> | null = null;
		try { session = await ctx.db.get(chatId as Id<"sessions">); } catch { /* use chat key lookup */ }
		if (!session) session = await ctx.db.query("sessions").withIndex("by_chat_key", (q) => q.eq("chatKey", chatId)).first();
		if (!session || session.userId !== identity.subject) throw new Error("Session not found");
		return session._id;
	},
});

export const findByToolCall = query({
	args: { toolCallId: v.string() },
	handler: async (ctx, { toolCallId }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthenticated");
		const item = await ctx.db.query("questionnaires").withIndex("by_tool_call", (q) => q.eq("toolCallId", toolCallId)).first();
		if (!item) return null;
		const session = await ctx.db.get(item.sessionId);
		return session?.userId === identity.subject ? item : null;
	},
});

export const submit = mutation({
	args: {
		sessionId: v.id("sessions"),
		toolCallId: v.string(),
		action: v.union(v.literal("submitted"), v.literal("skipped")),
		answers: v.array(v.any()),
	},
	handler: async (ctx, args) => {
		await ownedSession(ctx, args.sessionId);
		const messages = await ctx.db.query("messages")
			.withIndex("by_session_sequence", (q) => q.eq("sessionId", args.sessionId))
			.order("asc")
			.collect();
		let callMessage: (typeof messages)[number] | undefined;
		let callInput: unknown;
		const issued = new Set<string>();
		for (const message of messages) {
			if (message.role !== "assistant") continue;
			for (const part of message.parts as Array<Record<string, unknown>>) {
				const name = typeof part.toolName === "string" ? part.toolName : typeof part.type === "string" ? part.type.replace(/^tool-/, "") : "";
				if (name !== "askUserQuestionnaire" || typeof part.toolCallId !== "string") continue;
				issued.add(part.toolCallId);
				if (part.toolCallId === args.toolCallId) {
					callMessage = message;
					callInput = part.input;
				}
			}
		}
		if (!callMessage || !callInput) throw new Error("Questionnaire call not found in this session");
		const questionnaire = questionnaireInput.parse(callInput);
		const existing = await ctx.db.query("questionnaires")
			.withIndex("by_tool_call", (q) => q.eq("toolCallId", args.toolCallId))
			.first();
		let result: ToolOutput;
		if (existing) {
			if (existing.sessionId !== args.sessionId) throw new Error("Tool call already belongs to another session");
			result = existing.result as ToolOutput;
		} else {
			if (issued.size > 4) throw new Error("Questionnaire limit reached for this session");
			result = args.action === "submitted"
				? buildResult(crypto.randomUUID(), questionnaire, args.answers as AnswerInput[])
				: { status: "skipped", reason: "user_skipped" };
			const now = Date.now();
			await ctx.db.insert("questionnaires", {
				sessionId: args.sessionId,
				toolCallId: args.toolCallId,
				title: questionnaire.title ?? null,
				questions: questionnaire.questions,
				answers: result.status === "submitted" ? result.answers : [],
				result,
				status: result.status,
				createdAt: now,
			});
		}

		const callParts = callMessage.parts as Array<Record<string, unknown>>;
		await ctx.db.patch(callMessage._id, {
			parts: callParts.map((part) => {
				const name = typeof part.toolName === "string" ? part.toolName : typeof part.type === "string" ? part.type.replace(/^tool-/, "") : "";
				return name === "askUserQuestionnaire" && part.toolCallId === args.toolCallId
					? { ...part, state: "output-available", output: result, errorText: undefined }
					: part;
			}),
		});

		const answerMessageText = result.status === "submitted" ? formatQuestionnaireAnswers(result) : formatQuestionnaireSkipped();
		const priorAnswers = messages.filter((message) => {
			if (message.role !== "user" || !message.metadata || typeof message.metadata !== "object") return false;
			const turn = (message.metadata as { questionnaireTurn?: { toolCallId?: string } }).questionnaireTurn;
			return turn?.toolCallId === args.toolCallId;
		});
		const priorAnswer = priorAnswers[0];
		for (const duplicate of priorAnswers.slice(1)) await ctx.db.delete(duplicate._id);
		const stableId = questionnaireAnswerMessageId(args.toolCallId);
		const stableMessage = priorAnswer ?? messages.find((message) => message.messageId === stableId);
		if (stableMessage && stableMessage.role !== "user") throw new Error("Questionnaire answer message ID is already in use");
		const answerMessageId = stableMessage?.messageId ?? stableId;
		const priorMetadata = stableMessage?.metadata && typeof stableMessage.metadata === "object"
			? stableMessage.metadata as { createdAt?: string }
			: undefined;
		const createdAt = priorMetadata?.createdAt ?? new Date().toISOString();
		const questionnaireTurn = result.status === "submitted"
			? { toolCallId: args.toolCallId, status: "submitted" as const, ...(questionnaire.title !== undefined ? { title: questionnaire.title } : {}), answers: result.answers }
			: { toolCallId: args.toolCallId, status: "skipped" as const, ...(questionnaire.title !== undefined ? { title: questionnaire.title } : {}) };
		const metadata = { createdAt, questionnaireTurn };
		const messageParts = [{ type: "text", text: answerMessageText }];
		if (stableMessage) {
			await ctx.db.patch(stableMessage._id, { role: "user", parts: messageParts, metadata });
		} else {
			const lastMessage = await ctx.db.query("messages")
				.withIndex("by_session_sequence", (q) => q.eq("sessionId", args.sessionId))
				.order("desc")
				.first();
			await ctx.db.insert("messages", {
				sessionId: args.sessionId,
				messageId: answerMessageId,
				role: "user",
				parts: messageParts,
				metadata,
				sequence: (lastMessage?.sequence ?? 0) + 1,
				createdAt: Date.now(),
			});
		}
		await ctx.db.patch(args.sessionId, { updatedAt: Date.now() });
		return { result, answerMessage: { id: answerMessageId, text: answerMessageText, metadata } };
	},
});

export const closeDangling = mutation({
	args: { sessionId: v.id("sessions"), messageId: v.string(), parts: v.array(v.any()) },
	handler: async (ctx, { sessionId, messageId, parts }) => {
		await ownedSession(ctx, sessionId);
		const message = await ctx.db.query("messages").withIndex("by_session_sequence", (q) => q.eq("sessionId", sessionId)).collect();
		const stored = message.find((item: { messageId: string }) => item.messageId === messageId);
		if (stored) await ctx.db.patch(stored._id, { parts });
	},
});
