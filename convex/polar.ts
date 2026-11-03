"use node";

import { createPolar } from "@polar-sh/sdk/2026-04";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

function getPolar() {
	const accessToken = process.env.POLAR_ACCESS_TOKEN;
	if (!accessToken) {
		throw new Error("POLAR_ACCESS_TOKEN is not configured");
	}
	const server = process.env.POLAR_SERVER;
	return createPolar({
		accessToken,
		environment: server === "production" ? "production" : "sandbox",
	});
}

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function betaProductId() {
	const productId = process.env.POLAR_BETA_PRODUCT_ID?.trim();
	if (!productId) {
		throw new Error("POLAR_BETA_PRODUCT_ID is not configured");
	}
	if (!UUID_PATTERN.test(productId)) {
		throw new Error(
			`POLAR_BETA_PRODUCT_ID is not a valid UUID: "${productId}". ` +
				"Copy the exact product ID from the Polar dashboard."
		);
	}
	return productId;
}

function hasStatus(error: unknown, status: number) {
	return (
		typeof error === "object" &&
		error !== null &&
		"statusCode" in error &&
		(error as { statusCode?: unknown }).statusCode === status
	);
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export const ensureCustomer = internalAction({
	args: { clerkUserId: v.string() },
	handler: async (ctx, { clerkUserId }): Promise<{ polarCustomerId: string }> => {
		const user = await ctx.runQuery(internal.users.getByClerkId, {
			clerkUserId,
		});
		if (!user) {
			throw new Error(`User ${clerkUserId} not found`);
		}
		if (user.provisioningStatus === "deleted") {
			throw new Error(`User ${clerkUserId} is deleted`);
		}
		const polar = getPolar();

		let customer: Awaited<ReturnType<typeof polar.customers.getExternal>> | null =
			null;
		try {
			customer = await polar.customers.getExternal(clerkUserId);
		} catch (error) {
			if (!hasStatus(error, 404)) {
				throw error;
			}
		}

		if (!customer) {
			try {
				customer = await polar.customers.create({
					type: "individual",
					email: user.email,
					name: user.name,
					external_id: clerkUserId,
					metadata: { clerkUserId },
				});
			} catch (error) {
				// Concurrent provisioning for the same user: reuse the winner.
				if (hasStatus(error, 409)) {
					customer = await polar.customers.getExternal(clerkUserId);
				} else {
					throw error;
				}
			}
		} else if (customer.email !== user.email || customer.name !== user.name) {
			customer = await polar.customers.updateExternal(clerkUserId, {
				email: user.email,
				name: user.name,
			});
		}

		await ctx.runMutation(internal.users.setPolarCustomer, {
			clerkUserId,
			polarCustomerId: customer.id,
		});
		return { polarCustomerId: customer.id };
	},
});

export const ensureBetaSubscription = internalAction({
	args: { clerkUserId: v.string() },
	handler: async (
		ctx,
		{ clerkUserId }
	): Promise<{ polarSubscriptionId: string }> => {
		const user = await ctx.runQuery(internal.users.getByClerkId, {
			clerkUserId,
		});
		if (!user) {
			throw new Error(`User ${clerkUserId} not found`);
		}
		if (user.provisioningStatus === "deleted") {
			throw new Error(`User ${clerkUserId} is deleted`);
		}
		const polar = getPolar();
		const productId = betaProductId();

		const existing = await polar.subscriptions.list({
			external_customer_id: clerkUserId,
			product_id: productId,
			active: true,
			limit: 10,
		});
		const active = existing.items.find((sub) =>
			ACTIVE_STATUSES.has(sub.status)
		);
		if (active) {
			await ctx.runMutation(internal.users.setPolarSubscription, {
				clerkUserId,
				polarSubscriptionId: active.id,
			});
			return { polarSubscriptionId: active.id };
		}

		let subscription: Awaited<
			ReturnType<typeof polar.subscriptions.create>
		>;
		try {
			subscription = await polar.subscriptions.create({
				product_id: productId,
				external_customer_id: clerkUserId,
				metadata: { clerkUserId },
			});
		} catch (error) {
			if (!hasStatus(error, 409)) {
				throw error;
			}
			const retry = await polar.subscriptions.list({
				external_customer_id: clerkUserId,
				product_id: productId,
				active: true,
				limit: 10,
			});
			const found = retry.items.find((sub) =>
				ACTIVE_STATUSES.has(sub.status)
			);
			if (!found) {
				throw error;
			}
			subscription = found;
		}

		await ctx.runMutation(internal.users.setPolarSubscription, {
			clerkUserId,
			polarSubscriptionId: subscription.id,
		});
		return { polarSubscriptionId: subscription.id };
	},
});

function creditsMeterId() {
	const meterId = process.env.POLAR_CREDITS_METER_ID?.trim();
	if (!meterId) {
		throw new Error("POLAR_CREDITS_METER_ID is not configured");
	}
	return meterId;
}

export const syncCreditBalance = internalAction({
	args: { clerkUserId: v.string() },
	handler: async (
		ctx,
		{ clerkUserId }
	): Promise<"synced" | "no_meter"> => {
		const polar = getPolar();
		const meterId = creditsMeterId();
		// Primary: Customer State (customers:read scope, which the app
		// token already has). customerMeters.list needs a separate scope
		// the current token lacks, so it is only a fallback.
		let meter: {
			credited_units: number;
			consumed_units: number;
			balance: number;
		} | null = null;
		let periodEnd: number | undefined;
		try {
			const state = await polar.customers.getStateExternal(clerkUserId);
			const active = state.active_meters?.find(
				(m) => m.meter_id === meterId
			);
			if (active) {
				meter = active;
			}
			const sub = state.active_subscriptions?.[0] as
				| { current_period_end?: string | null }
				| undefined;
			if (sub?.current_period_end) {
				const parsed = Date.parse(sub.current_period_end);
				if (!Number.isNaN(parsed)) {
					periodEnd = parsed;
				}
			}
		} catch (error) {
			// Fall through to the Customer Meters API, but don't hide why.
			console.error("Polar customer state lookup failed", {
				clerkUserId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
		if (!meter) {
			const listed = await polar.customerMeters.list({
				external_customer_id: clerkUserId,
				meter_id: meterId,
				limit: 10,
			});
			meter = listed.items[0] ?? null;
		}
		if (!meter) {
			console.error("No Polar credit meter found for user", { clerkUserId });
			return "no_meter";
		}
		await ctx.runMutation(internal.credits.upsertAccount, {
			userId: clerkUserId,
			creditedUnits: meter.credited_units,
			consumedUnits: meter.consumed_units,
			balance: meter.balance,
			periodEnd,
		});
		// Self-heal: if event ingestion failed earlier (e.g. Polar token
		// scopes), retry now that a sync was requested.
		await ctx.runMutation(internal.credits.requeueFailedIngests, {
			userId: clerkUserId,
		});
		return "synced";
	},
});

export const grantCredits = internalAction({
	args: {
		clerkUserId: v.string(),
		units: v.number(),
		rollover: v.optional(v.boolean()),
		reason: v.optional(v.string()),
		externalId: v.optional(v.string()),
	},
	handler: async (
		ctx,
		{ clerkUserId, units, rollover, reason, externalId }
	): Promise<{ granted: number; balance: number | null }> => {
		if (!Number.isInteger(units) || units < 1 || units > 10_000) {
			throw new Error("units must be a whole number between 1 and 10000");
		}
		const { polarCustomerId } = await ctx.runAction(
			internal.polar.ensureCustomer,
			{ clerkUserId }
		);
		await ctx.runAction(internal.polar.ensureBetaSubscription, {
			clerkUserId,
		});
		const meterId = creditsMeterId();
		const grantExternalId =
			externalId ?? `grant-${clerkUserId}-${Date.now()}`;
		const base =
			process.env.POLAR_SERVER === "production"
				? "https://api.polar.sh"
				: "https://sandbox-api.polar.sh";
		const accessToken = process.env.POLAR_ACCESS_TOKEN;
		if (!accessToken) {
			throw new Error("POLAR_ACCESS_TOKEN is not configured");
		}
		const response = await fetch(`${base}/v1/customer-meters/credits`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"Polar-Version": "2027-01",
			},
			body: JSON.stringify({
				customer_id: polarCustomerId,
				meter_id: meterId,
				units,
				rollover: rollover ?? false,
				external_id: grantExternalId,
			}),
		});
		const payload = (await response.json().catch(() => null)) as {
			id?: string;
			detail?: unknown;
		} | null;
		if (!response.ok) {
			throw new Error(
				`Polar credit grant failed (${response.status}): ${JSON.stringify(payload?.detail ?? payload).slice(0, 300)}`
			);
		}
		await ctx.runMutation(internal.credits.recordGrant, {
			userId: clerkUserId,
			units,
			rollover: rollover ?? false,
			reason,
			source: "polar",
			polarEventId: payload?.id,
			externalId: grantExternalId,
		});
		await ctx.runAction(internal.polar.syncCreditBalance, { clerkUserId });
		const account = await ctx.runQuery(internal.credits.getAccountByUser, {
			userId: clerkUserId,
		});
		return { granted: units, balance: account.balance };
	},
});

export const ingestCreditUsage = internalAction({
	args: { creditTurnId: v.id("credit_turns") },
	handler: async (ctx, { creditTurnId }): Promise<null> => {
		const turn = await ctx.runQuery(internal.credits.getTurn, {
			creditTurnId,
		});
		if (!turn || turn.chargedCredits < 1 || turn.polarStatus === "ingested") {
			return null;
		}
		const polar = getPolar();
		creditsMeterId();
		try {
			// The Polar meter aggregates with Count, so one event = one
			// credit. external_id makes retries idempotent in Polar.
			await polar.events.ingest({
				events: Array.from({ length: turn.chargedCredits }, (_, i) => ({
					name: "phixr_credit_used",
					external_customer_id: turn.userId,
					external_id: `${turn.turnId}:${i + 1}`,
					metadata: {
						turnId: turn.turnId,
						sessionId: String(turn.sessionId),
						seq: i + 1,
						bandCredits: turn.chargedCredits,
						band: turn.band ?? turn.chargedCredits,
						exaCalls: turn.exaCalls,
					},
				})),
			});
		} catch (error) {
			await ctx.runMutation(internal.credits.markIngestFailed, {
				creditTurnId,
				error: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
		await ctx.runMutation(internal.credits.markIngested, { creditTurnId });
		return null;
	},
});

export const revokeBetaSubscription = internalAction({
	args: { clerkUserId: v.string() },
	handler: async (ctx, { clerkUserId }): Promise<null> => {
		const user = await ctx.runQuery(internal.users.getByClerkId, {
			clerkUserId,
		});
		const polar = getPolar();
		const productId = betaProductId();

		const listed = await polar.subscriptions.list({
			external_customer_id: clerkUserId,
			product_id: productId,
			active: true,
			limit: 10,
		});
		const targets = listed.items.filter((sub) =>
			ACTIVE_STATUSES.has(sub.status)
		);
		// Fall back to the stored ID if listing misses it.
		if (
			targets.length === 0 &&
			user?.polarSubscriptionId &&
			!listed.items.some((sub) => sub.id === user.polarSubscriptionId)
		) {
			try {
				const stored = await polar.subscriptions.get(
					user.polarSubscriptionId
				);
				if (ACTIVE_STATUSES.has(stored.status)) {
					targets.push(stored);
				}
			} catch (error) {
				if (!hasStatus(error, 404)) {
					throw error;
				}
			}
		}

		for (const sub of targets) {
			try {
				await polar.subscriptions.revoke(sub.id);
			} catch (error) {
				// Already revoked/canceled between list and revoke.
				if (!hasStatus(error, 409)) {
					throw error;
				}
			}
		}
		return null;
	},
});
