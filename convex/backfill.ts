"use node";

import { createClerkClient } from "@clerk/backend";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

type ClerkUserLike = {
	id: string;
	firstName?: string | null;
	lastName?: string | null;
	imageUrl?: string;
	primaryEmailAddressId?: string | null;
	updatedAt?: number;
	createdAt?: number;
	emailAddresses?: Array<{ id: string; emailAddress: string }>;
	// Snake-case fallbacks if the payload shape differs.
	first_name?: string | null;
	last_name?: string | null;
	image_url?: string;
	primary_email_address_id?: string | null;
	updated_at?: number;
	created_at?: number;
	email_addresses?: Array<{ id: string; email_address: string }>;
};

const PAGE_SIZE = 100;

export const backfillExistingUsers = internalAction({
	args: { offset: v.optional(v.number()) },
	handler: async (
		ctx,
		{ offset = 0 }
	): Promise<{ enqueued: number; nextOffset: number | null }> => {
		const secretKey = process.env.CLERK_SECRET_KEY;
		if (!secretKey) {
			throw new Error("CLERK_SECRET_KEY is not configured");
		}
		const clerk = createClerkClient({ secretKey });
		const { data, totalCount } = await clerk.users.getUserList({
			limit: PAGE_SIZE,
			offset,
			orderBy: "created_at",
		});

		let enqueued = 0;
		for (const raw of data as ClerkUserLike[]) {
			const emails = (raw.emailAddresses ?? []).map((entry) => ({
				id: entry.id,
				email: entry.emailAddress,
			}));
			if (emails.length === 0 && raw.email_addresses) {
				for (const entry of raw.email_addresses) {
					emails.push({ id: entry.id, email: entry.email_address });
				}
			}
			const primaryId =
				raw.primaryEmailAddressId ?? raw.primary_email_address_id;
			const primary =
				emails.find((entry) => entry.id === primaryId) ?? emails[0];
			if (!primary) {
				continue;
			}
			const clerkUpdatedAt =
				raw.updatedAt ?? raw.updated_at ?? raw.createdAt ?? raw.created_at ?? 0;
			await ctx.runMutation(internal.onboarding.enqueueUserEvent, {
				clerkUserId: raw.id,
				eventType: "user.created",
				email: primary.email,
				firstName: raw.firstName ?? raw.first_name ?? null,
				lastName: raw.lastName ?? raw.last_name ?? null,
				imageUrl: raw.imageUrl ?? raw.image_url,
				clerkUpdatedAt,
				sendWelcome: false,
			});
			enqueued += 1;
		}

		const nextOffset = offset + data.length < totalCount ? offset + data.length : null;
		if (nextOffset !== null) {
			await ctx.scheduler.runAfter(
				0,
				internal.backfill.backfillExistingUsers,
				{ offset: nextOffset }
			);
		}
		return { enqueued, nextOffset };
	},
});
