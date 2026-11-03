import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";

const RESERVATION_TTL_MS = 10 * 60 * 1000;
export const MAX_TURN_CREDITS = 3;

async function requireUserId(ctx: {
	auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Unauthenticated");
	}
	return identity.subject;
}

type DbCtx = QueryCtx | MutationCtx;

async function sweepExpired(ctx: MutationCtx, userId: string) {
	const now = Date.now();
	const reserved = await ctx.db
		.query("credit_turns")
		.withIndex("by_user_status", (q) =>
			q.eq("userId", userId).eq("status", "reserved")
		)
		.collect();
	for (const turn of reserved) {
		if (now - turn.createdAt > RESERVATION_TTL_MS) {
			await ctx.db.patch(turn._id, {
				status: "released",
				chargedCredits: 0,
				outcome: "reservation_expired",
				updatedAt: now,
			});
		}
	}
	return reserved.filter((t) => now - t.createdAt <= RESERVATION_TTL_MS);
}

async function pendingDeductions(ctx: DbCtx, userId: string) {
	const settled = await ctx.db
		.query("credit_turns")
		.withIndex("by_user_status", (q) =>
			q.eq("userId", userId).eq("status", "settled")
		)
		.collect();
	return settled
		.filter((t) => t.polarStatus === "pending" || t.polarStatus === "failed")
		.reduce((sum, t) => sum + t.chargedCredits, 0);
}

export type AccountView = {
	synced: boolean;
	creditedUnits: number;
	consumedUnits: number;
	balance: number | null;
	reservedCredits: number;
	pendingCredits: number;
	available: number | null;
	periodEnd: number | null;
	syncedAt: number | null;
};

async function accountView(
	ctx: DbCtx,
	userId: string
): Promise<AccountView> {
	const account = await ctx.db
		.query("credit_accounts")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.unique();
	const reservedRows = await ctx.db
		.query("credit_turns")
		.withIndex("by_user_status", (q) =>
			q.eq("userId", userId).eq("status", "reserved")
		)
		.collect();
	const now = Date.now();
	const reservedCredits = reservedRows
		.filter((t) => now - t.createdAt <= RESERVATION_TTL_MS)
		.reduce((sum, t) => sum + t.reservedCredits, 0);
	const pendingCredits = await pendingDeductions(ctx, userId);
	if (!account) {
		return {
			synced: false,
			creditedUnits: 0,
			consumedUnits: 0,
			balance: null as number | null,
			reservedCredits,
			pendingCredits,
			available: null as number | null,
			periodEnd: null as number | null,
			syncedAt: null as number | null,
		};
	}
	const available = account.balance - reservedCredits - pendingCredits;
	return {
		synced: true,
		creditedUnits: account.creditedUnits,
		consumedUnits: account.consumedUnits,
		balance: account.balance,
		reservedCredits,
		pendingCredits,
		available,
		periodEnd: account.periodEnd ?? null,
		syncedAt: account.syncedAt,
	};
}

export const getMyCredits = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return null;
		}
		return await accountView(ctx, identity.subject);
	},
});

export const getAccountByUser = internalQuery({
	args: { userId: v.string() },
	handler: async (ctx, { userId }) => await accountView(ctx, userId),
});

export const refreshMyCredits = action({
	args: {},
	handler: async (ctx): Promise<AccountView> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthenticated");
		}
		const first = await ctx.runAction(internal.polar.syncCreditBalance, {
			clerkUserId: identity.subject,
		});
		if (first === "no_meter") {
			// Existing users provisioned before credits (or in the wrong
			// Polar environment) have no meter. Re-running the idempotent
			// onboarding Polar steps creates it, then sync again.
			await ctx.runAction(internal.polar.ensureCustomer, {
				clerkUserId: identity.subject,
			});
			await ctx.runAction(internal.polar.ensureBetaSubscription, {
				clerkUserId: identity.subject,
			});
			await ctx.runAction(internal.polar.syncCreditBalance, {
				clerkUserId: identity.subject,
			});
		}
		return await ctx.runQuery(internal.credits.getAccountByUser, {
			userId: identity.subject,
		});
	},
});

export const reserve = mutation({
	args: { sessionId: v.id("sessions"), turnId: v.string() },
	handler: async (ctx, { sessionId, turnId }) => {
		const userId = await requireUserId(ctx);
		const session = await ctx.db.get(sessionId);
		if (!session || session.userId !== userId) {
			throw new Error("Session not found");
		}
		const existing = await ctx.db
			.query("credit_turns")
			.withIndex("by_turn", (q) => q.eq("turnId", turnId))
			.unique();
		if (existing && existing.userId === userId) {
			return {
				allowed: existing.status !== "released",
				duplicate: true,
				creditTurnId: existing._id,
				available: null,
			};
		}
		const open = await sweepExpired(ctx, userId);
		const view = await accountView(ctx, userId);
		// No Polar sync yet (e.g. onboarding still running): fail open and
		// sync in the background rather than blocking a new user.
		if (!view.synced) {
			await ctx.scheduler.runAfter(0, internal.polar.syncCreditBalance, {
				clerkUserId: userId,
			});
		}
		if (view.synced && (view.available ?? 0) < 1) {
			return { allowed: false, duplicate: false, available: view.available };
		}
		const now = Date.now();
		const creditTurnId = await ctx.db.insert("credit_turns", {
			userId,
			sessionId,
			turnId,
			status: "reserved",
			polarStatus: "not_required",
			reservedCredits: MAX_TURN_CREDITS,
			chargedCredits: 0,
			toolNames: [],
			exaCalls: 0,
			retryCount: 0,
			createdAt: now,
			updatedAt: now,
		});
		void open;
		return {
			allowed: true,
			duplicate: false,
			creditTurnId,
			available: view.available,
		};
	},
});

export const settle = mutation({
	args: {
		turnId: v.string(),
		sessionId: v.optional(v.id("sessions")),
		chargedCredits: v.number(),
		band: v.number(),
		toolNames: v.array(v.string()),
		exaCalls: v.number(),
		inputTokens: v.optional(v.number()),
		outputTokens: v.optional(v.number()),
		totalTokens: v.optional(v.number()),
		finishReason: v.optional(v.string()),
		outcome: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const turn = await ctx.db
			.query("credit_turns")
			.withIndex("by_turn", (q) => q.eq("turnId", args.turnId))
			.unique();
		if (!turn || turn.userId !== userId) {
			// No reservation (shadow mode at zero balance, or reserve
			// failed open): still record usage for cost tracking.
			if (args.sessionId) {
				await ctx.db.insert("ai_usage", {
					userId,
					sessionId: args.sessionId,
					turnId: args.turnId,
					band: args.band,
					chargedCredits: 0,
					toolNames: args.toolNames,
					exaCalls: args.exaCalls,
					inputTokens: args.inputTokens,
					outputTokens: args.outputTokens,
					totalTokens: args.totalTokens,
					finishReason: args.finishReason,
					outcome: args.outcome,
					createdAt: Date.now(),
				});
			}
			return { settled: false, chargedCredits: 0 };
		}
		if (turn.status === "settled") {
			return { settled: true, chargedCredits: turn.chargedCredits };
		}
		const view = await accountView(ctx, userId);
		let charged = Math.max(0, Math.min(args.chargedCredits, MAX_TURN_CREDITS));
		if (view.synced && charged > 0) {
			// Cap at what is actually available for this turn (its own
			// reservation is being released by settling).
			const availableForTurn =
				(view.balance ?? 0) -
				Math.max(0, view.reservedCredits - turn.reservedCredits) -
				view.pendingCredits;
			charged = Math.min(charged, Math.max(0, availableForTurn));
		}
		const now = Date.now();
		await ctx.db.patch(turn._id, {
			status: charged > 0 || args.outcome !== "released" ? "settled" : "released",
			polarStatus: charged > 0 ? "pending" : "not_required",
			chargedCredits: charged,
			band: args.band,
			toolNames: args.toolNames,
			exaCalls: args.exaCalls,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			totalTokens: args.totalTokens,
			finishReason: args.finishReason,
			outcome: args.outcome,
			settledAt: now,
			updatedAt: now,
		});
		await ctx.db.insert("ai_usage", {
			userId,
			sessionId: turn.sessionId,
			turnId: args.turnId,
			band: args.band,
			chargedCredits: charged,
			toolNames: args.toolNames,
			exaCalls: args.exaCalls,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			totalTokens: args.totalTokens,
			finishReason: args.finishReason,
			outcome: args.outcome,
			createdAt: now,
		});
		if (charged > 0) {
			await ctx.scheduler.runAfter(0, internal.polar.ingestCreditUsage, {
				creditTurnId: turn._id,
			});
		}
		return { settled: true, chargedCredits: charged };
	},
});

export const release = mutation({
	args: { turnId: v.string(), outcome: v.optional(v.string()) },
	handler: async (ctx, { turnId, outcome }) => {
		const userId = await requireUserId(ctx);
		const turn = await ctx.db
			.query("credit_turns")
			.withIndex("by_turn", (q) => q.eq("turnId", turnId))
			.unique();
		if (!turn || turn.userId !== userId || turn.status !== "reserved") {
			return;
		}
		await ctx.db.patch(turn._id, {
			status: "released",
			chargedCredits: 0,
			outcome: outcome ?? "released",
			updatedAt: Date.now(),
		});
	},
});

export const backfillExistingUsers = internalAction({
	args: {},
	handler: async (
		ctx
	): Promise<{
		total: number;
		synced: number;
		noMeter: string[];
		failed: string[];
	}> => {
		const userIds = await ctx.runQuery(internal.users.listProvisioned, {});
		let synced = 0;
		const noMeter: string[] = [];
		const failed: string[] = [];
		for (const clerkUserId of userIds) {
			try {
				await ctx.runAction(internal.polar.ensureCustomer, {
					clerkUserId,
				});
				await ctx.runAction(internal.polar.ensureBetaSubscription, {
					clerkUserId,
				});
				const result = await ctx.runAction(
					internal.polar.syncCreditBalance,
					{ clerkUserId }
				);
				if (result === "synced") {
					synced += 1;
				} else {
					noMeter.push(clerkUserId);
				}
			} catch (error) {
				console.error("Credit backfill failed for user", {
					clerkUserId,
					error: error instanceof Error ? error.message : String(error),
				});
				failed.push(clerkUserId);
			}
		}
		return { total: userIds.length, synced, noMeter, failed };
	},
});

export const recordGrant = internalMutation({
	args: {
		userId: v.string(),
		units: v.number(),
		rollover: v.boolean(),
		reason: v.optional(v.string()),
		source: v.union(v.literal("polar"), v.literal("local")),
		polarEventId: v.optional(v.string()),
		externalId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("credit_grants", {
			...args,
			createdAt: Date.now(),
		});
	},
});

export const upsertAccount = internalMutation({
	args: {
		userId: v.string(),
		creditedUnits: v.number(),
		consumedUnits: v.number(),
		balance: v.number(),
		periodEnd: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("credit_accounts")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.unique();
		const now = Date.now();
		if (existing) {
			await ctx.db.patch(existing._id, {
				creditedUnits: args.creditedUnits,
				consumedUnits: args.consumedUnits,
				balance: args.balance,
				periodEnd: args.periodEnd ?? existing.periodEnd,
				syncedAt: now,
				updatedAt: now,
			});
			return existing._id;
		}
		return await ctx.db.insert("credit_accounts", {
			userId: args.userId,
			creditedUnits: args.creditedUnits,
			consumedUnits: args.consumedUnits,
			balance: args.balance,
			periodEnd: args.periodEnd,
			syncedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const getTurn = internalQuery({
	args: { creditTurnId: v.id("credit_turns") },
	handler: async (ctx, { creditTurnId }) => await ctx.db.get(creditTurnId),
});

export const requeueFailedIngests = internalMutation({
	args: { userId: v.string() },
	handler: async (ctx, { userId }) => {
		const settled = await ctx.db
			.query("credit_turns")
			.withIndex("by_user_status", (q) =>
				q.eq("userId", userId).eq("status", "settled")
			)
			.collect();
		for (const turn of settled) {
			if (turn.polarStatus !== "failed" || turn.chargedCredits < 1) {
				continue;
			}
			await ctx.db.patch(turn._id, {
				retryCount: 0,
				updatedAt: Date.now(),
			});
			await ctx.scheduler.runAfter(0, internal.polar.ingestCreditUsage, {
				creditTurnId: turn._id,
			});
		}
	},
});

export const markIngested = internalMutation({
	args: { creditTurnId: v.id("credit_turns") },
	handler: async (ctx, { creditTurnId }) => {
		const turn = await ctx.db.get(creditTurnId);
		if (!turn) {
			return;
		}
		await ctx.db.patch(creditTurnId, {
			polarStatus: "ingested",
			updatedAt: Date.now(),
		});
		await ctx.scheduler.runAfter(0, internal.polar.syncCreditBalance, {
			clerkUserId: turn.userId,
		});
	},
});

export const markIngestFailed = internalMutation({
	args: { creditTurnId: v.id("credit_turns"), error: v.string() },
	handler: async (ctx, { creditTurnId, error }) => {
		const turn = await ctx.db.get(creditTurnId);
		if (!turn) {
			return;
		}
		const retryCount = turn.retryCount + 1;
		await ctx.db.patch(creditTurnId, {
			polarStatus: "failed",
			retryCount,
			outcome: `ingest_failed: ${error.slice(0, 200)}`,
			updatedAt: Date.now(),
		});
		if (retryCount <= 5) {
			await ctx.scheduler.runAfter(
				Math.min(60_000, 1000 * 2 ** retryCount),
				internal.polar.ingestCreditUsage,
				{ creditTurnId }
			);
		}
	},
});
