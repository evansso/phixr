import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		clerkUserId: v.string(),
		email: v.string(),
		name: v.string(),
		imageUrl: v.optional(v.string()),
		polarCustomerId: v.optional(v.string()),
		polarSubscriptionId: v.optional(v.string()),
		provisioningStatus: v.union(
			v.literal("pending"),
			v.literal("provisioning"),
			v.literal("active"),
			v.literal("failed"),
			v.literal("deleted")
		),
		clerkUpdatedAt: v.number(),
		lastProvisioningError: v.optional(v.string()),
		deletedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_clerk_id", ["clerkUserId"])
		.index("by_email", ["email"]),
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
	credit_accounts: defineTable({
		userId: v.string(),
		creditedUnits: v.number(),
		consumedUnits: v.number(),
		balance: v.number(),
		periodEnd: v.optional(v.number()),
		syncedAt: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"]),
	credit_turns: defineTable({
		userId: v.string(),
		sessionId: v.id("sessions"),
		turnId: v.string(),
		status: v.union(
			v.literal("reserved"),
			v.literal("settled"),
			v.literal("released")
		),
		polarStatus: v.union(
			v.literal("not_required"),
			v.literal("pending"),
			v.literal("ingested"),
			v.literal("failed")
		),
		reservedCredits: v.number(),
		chargedCredits: v.number(),
		band: v.optional(v.number()),
		toolNames: v.array(v.string()),
		exaCalls: v.number(),
		inputTokens: v.optional(v.number()),
		outputTokens: v.optional(v.number()),
		totalTokens: v.optional(v.number()),
		finishReason: v.optional(v.string()),
		outcome: v.optional(v.string()),
		retryCount: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
		settledAt: v.optional(v.number()),
	})
		.index("by_user_status", ["userId", "status"])
		.index("by_turn", ["turnId"])
		.index("by_session", ["sessionId"]),
	ai_usage: defineTable({
		userId: v.string(),
		sessionId: v.id("sessions"),
		turnId: v.string(),
		band: v.number(),
		chargedCredits: v.number(),
		toolNames: v.array(v.string()),
		exaCalls: v.number(),
		inputTokens: v.optional(v.number()),
		outputTokens: v.optional(v.number()),
		totalTokens: v.optional(v.number()),
		finishReason: v.optional(v.string()),
		outcome: v.string(),
		createdAt: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_session", ["sessionId"])
		.index("by_turn", ["turnId"]),
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
