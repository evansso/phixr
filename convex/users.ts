import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

export function displayName(args: {
	firstName?: string | null;
	lastName?: string | null;
	email: string;
}) {
	const full = [args.firstName, args.lastName]
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(" ");
	if (full) {
		return full;
	}
	const prefix = args.email.split("@")[0]?.trim();
	return prefix || "user";
}

export const getByClerkId = internalQuery({
	args: { clerkUserId: v.string() },
	handler: async (ctx, { clerkUserId }) => {
		return await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
			.unique();
	},
});

export const upsertFromClerk = internalMutation({
	args: {
		clerkUserId: v.string(),
		email: v.string(),
		firstName: v.optional(v.union(v.string(), v.null())),
		lastName: v.optional(v.union(v.string(), v.null())),
		imageUrl: v.optional(v.string()),
		clerkUpdatedAt: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
			.unique();
		const now = Date.now();
		const name = displayName(args);
		if (existing) {
			if (args.clerkUpdatedAt < existing.clerkUpdatedAt) {
				return { userId: existing._id, stale: true };
			}
			await ctx.db.patch(existing._id, {
				email: args.email,
				name,
				imageUrl: args.imageUrl,
				clerkUpdatedAt: args.clerkUpdatedAt,
				provisioningStatus:
					existing.provisioningStatus === "active"
						? "active"
						: "provisioning",
				deletedAt: undefined,
				updatedAt: now,
			});
			return { userId: existing._id, stale: false };
		}
		const userId = await ctx.db.insert("users", {
			clerkUserId: args.clerkUserId,
			email: args.email,
			name,
			imageUrl: args.imageUrl,
			provisioningStatus: "provisioning",
			clerkUpdatedAt: args.clerkUpdatedAt,
			createdAt: now,
			updatedAt: now,
		});
		return { userId, stale: false };
	},
});

export const listProvisioned = internalQuery({
	args: {},
	handler: async (ctx) => {
		const users = await ctx.db.query("users").collect();
		return users
			.filter((u) => u.provisioningStatus !== "deleted")
			.map((u) => u.clerkUserId);
	},
});

export const setPolarCustomer = internalMutation({
	args: { clerkUserId: v.string(), polarCustomerId: v.string() },
	handler: async (ctx, { clerkUserId, polarCustomerId }) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
			.unique();
		if (!user || user.provisioningStatus === "deleted") {
			return;
		}
		await ctx.db.patch(user._id, { polarCustomerId, updatedAt: Date.now() });
	},
});

export const setPolarSubscription = internalMutation({
	args: {
		clerkUserId: v.string(),
		polarSubscriptionId: v.optional(v.string()),
	},
	handler: async (ctx, { clerkUserId, polarSubscriptionId }) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
			.unique();
		if (!user || user.provisioningStatus === "deleted") {
			return;
		}
		await ctx.db.patch(user._id, {
			polarSubscriptionId,
			updatedAt: Date.now(),
		});
	},
});

export const markProvisioned = internalMutation({
	args: { clerkUserId: v.string() },
	handler: async (ctx, { clerkUserId }) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
			.unique();
		if (!user || user.provisioningStatus === "deleted") {
			return;
		}
		await ctx.db.patch(user._id, {
			provisioningStatus: "active",
			lastProvisioningError: undefined,
			updatedAt: Date.now(),
		});
	},
});

export const markFailed = internalMutation({
	args: { clerkUserId: v.string(), error: v.string() },
	handler: async (ctx, { clerkUserId, error }) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
			.unique();
		if (!user || user.provisioningStatus === "deleted") {
			return;
		}
		await ctx.db.patch(user._id, {
			provisioningStatus: "failed",
			lastProvisioningError: error.slice(0, 500),
			updatedAt: Date.now(),
		});
	},
});

export const softDelete = internalMutation({
	args: { clerkUserId: v.string(), clerkUpdatedAt: v.number() },
	handler: async (ctx, { clerkUserId, clerkUpdatedAt }) => {
		const existing = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
			.unique();
		const now = Date.now();
		if (existing) {
			if (clerkUpdatedAt < existing.clerkUpdatedAt) {
				return {
					polarSubscriptionId: existing.polarSubscriptionId,
					stale: true,
				};
			}
			await ctx.db.patch(existing._id, {
				provisioningStatus: "deleted" as const,
				clerkUpdatedAt,
				deletedAt: now,
				updatedAt: now,
			});
			return {
				polarSubscriptionId: existing.polarSubscriptionId,
				stale: false,
			};
		}
		await ctx.db.insert("users", {
			clerkUserId,
			email: "",
			name: "user",
			provisioningStatus: "deleted",
			clerkUpdatedAt,
			deletedAt: now,
			createdAt: now,
			updatedAt: now,
		});
		return { polarSubscriptionId: undefined, stale: false };
	},
});

/**
 * Logical link between sessions and users: sessions.userId stores the
 * Clerk user ID, which is the same value as users.clerkUserId. This
 * resolves the owning user for a session through that indexed join.
 */
export const forSession = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, { sessionId }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return null;
		}
		const session = await ctx.db.get(sessionId);
		if (!session || session.userId !== identity.subject) {
			return null;
		}
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkUserId", session.userId))
			.unique();
		if (!user) {
			return null;
		}
		return {
			_id: user._id,
			clerkUserId: user.clerkUserId,
			email: user.email,
			name: user.name,
			imageUrl: user.imageUrl,
			polarCustomerId: user.polarCustomerId,
			polarSubscriptionId: user.polarSubscriptionId,
			provisioningStatus: user.provisioningStatus,
		};
	},
});

export const me = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return null;
		}
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
			.unique();
		if (!user) {
			return null;
		}
		return {
			_id: user._id,
			clerkUserId: user.clerkUserId,
			email: user.email,
			name: user.name,
			imageUrl: user.imageUrl,
			polarCustomerId: user.polarCustomerId,
			polarSubscriptionId: user.polarSubscriptionId,
			provisioningStatus: user.provisioningStatus,
		};
	},
});
