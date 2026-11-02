"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const sendWelcome = internalAction({
	args: { clerkUserId: v.string() },
	handler: async (ctx, { clerkUserId }): Promise<null> => {
		const apiKey = process.env.RESEND_API_KEY;
		if (!apiKey) {
			throw new Error("RESEND_API_KEY is not configured");
		}
		const user = await ctx.runQuery(internal.users.getByClerkId, {
			clerkUserId,
		});
		if (!user || user.provisioningStatus === "deleted" || !user.email) {
			return null;
		}
		// users.name is "<first> <last>", or the email prefix when Clerk
		// provided no name — the first token is the template's first_name.
		const firstName =
			user.name.trim().split(/\s+/)[0] ??
			user.email.split("@")[0] ??
			"there";

		const resend = new Resend(apiKey);
		const templateId =
			process.env.RESEND_WELCOME_TEMPLATE_ID ?? "welcome-email-beta";
		const from = process.env.RESEND_FROM_EMAIL;
		const { error } = await resend.emails.send(
			{
				...(from ? { from } : {}),
				to: user.email,
				template: {
					id: templateId,
					variables: { first_name: firstName },
				},
			},
			{ idempotencyKey: `welcome-user/${clerkUserId}` }
		);
		if (error) {
			throw new Error(`Resend welcome email failed: ${error.message}`);
		}
		return null;
	},
});
