import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

type ClerkEmailAddress = {
	id?: string;
	email_address?: string;
};

type ClerkUserData = {
	id: string;
	email_addresses?: ClerkEmailAddress[];
	primary_email_address_id?: string | null;
	first_name?: string | null;
	last_name?: string | null;
	image_url?: string;
	created_at?: number;
	updated_at?: number;
	deleted?: boolean;
};

type ClerkEvent = {
	type: string;
	data: ClerkUserData;
};

const http = httpRouter();

http.route({
	path: "/webhooks/clerk",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const secret = process.env.CLERK_WEBHOOK_SECRET;
		if (!secret) {
			return new Response("CLERK_WEBHOOK_SECRET is not configured", {
				status: 500,
			});
		}
		const svixId = request.headers.get("svix-id");
		const svixTimestamp = request.headers.get("svix-timestamp");
		const svixSignature = request.headers.get("svix-signature");
		if (!svixId || !svixTimestamp || !svixSignature) {
			return new Response("Missing Svix headers", { status: 400 });
		}

		const body = await request.text();
		try {
			// svix v2: verify() only validates the signature and returns
			// undefined; it no longer returns the parsed payload.
			new Webhook(secret).verify(body, {
				"svix-id": svixId,
				"svix-timestamp": svixTimestamp,
				"svix-signature": svixSignature,
			});
		} catch {
			return new Response("Invalid webhook signature", { status: 400 });
		}

		let event: ClerkEvent;
		try {
			const parsed: unknown = JSON.parse(body);
			if (
				typeof parsed !== "object" ||
				parsed === null ||
				typeof (parsed as { type?: unknown }).type !== "string"
			) {
				return new Response("Invalid webhook payload", { status: 400 });
			}
			event = parsed as ClerkEvent;
		} catch {
			return new Response("Invalid webhook payload", { status: 400 });
		}

		if (
			event.type !== "user.created" &&
			event.type !== "user.updated" &&
			event.type !== "user.deleted"
		) {
			return new Response(null, { status: 200 });
		}

		const data: ClerkUserData | undefined = event.data;
		if (!data?.id) {
			return new Response("Invalid webhook payload", { status: 400 });
		}
		const primary =
			data.email_addresses?.find(
				(entry) => entry.id === data.primary_email_address_id
			) ?? data.email_addresses?.[0];

		await ctx.runMutation(internal.onboarding.enqueueUserEvent, {
			clerkUserId: data.id,
			eventType: event.type,
			email: primary?.email_address,
			firstName: data.first_name ?? null,
			lastName: data.last_name ?? null,
			imageUrl: data.image_url,
			clerkUpdatedAt: data.updated_at ?? data.created_at ?? Date.now(),
			sendWelcome: event.type === "user.created",
		});

		return new Response(null, { status: 200 });
	}),
});

export default http;
