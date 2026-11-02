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
