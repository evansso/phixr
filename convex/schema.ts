import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	sessions: defineTable({
		userId: v.string(),
		chatKey: v.optional(v.string()),
		title: v.string(),
		status: v.union(
			v.literal("active"),
			v.literal("resolved"),
			v.literal("archived")
		),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_updated", ["userId", "updatedAt"])
		.index("by_user", ["userId"])
		.index("by_chat_key", ["chatKey"]),
	messages: defineTable({
		sessionId: v.id("sessions"),
		messageId: v.string(),
		role: v.union(
			v.literal("user"),
			v.literal("assistant"),
			v.literal("system")
		),
		parts: v.array(v.any()),
		metadata: v.optional(v.any()),
		sequence: v.number(),
		createdAt: v.number(),
	})
		.index("by_session_sequence", ["sessionId", "sequence"])
		.index("by_session_message", ["sessionId", "messageId"])
		.index("by_session", ["sessionId"]),
	questionnaires: defineTable({
		sessionId: v.id("sessions"),
		toolCallId: v.string(),
		title: v.union(v.string(), v.null()),
		questions: v.array(v.any()),
		answers: v.array(v.any()),
		result: v.any(),
		status: v.union(v.literal("submitted"), v.literal("skipped")),
		createdAt: v.number(),
	})
		.index("by_tool_call", ["toolCallId"])
		.index("by_session", ["sessionId"]),
	guide_step_results: defineTable({
		sessionId: v.id("sessions"),
		toolCallId: v.string(),
		stepId: v.string(),
		outcome: v.union(
			v.literal("matched_expected"),
			v.literal("different_result"),
			v.literal("error"),
			v.literal("could_not_run"),
			v.literal("needs_help"),
			v.literal("interrupted")
		),
		pastedOutputFull: v.optional(v.string()),
		pastedOutputForModel: v.optional(v.string()),
		note: v.optional(v.string()),
		createdAt: v.number(),
	})
		.index("by_tool_step", ["toolCallId", "stepId"])
		.index("by_tool_call", ["toolCallId"])
		.index("by_session", ["sessionId"]),
});
