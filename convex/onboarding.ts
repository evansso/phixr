import {
	WorkflowManager,
	vWorkflowId,
	type WorkflowId,
} from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const workflow = new WorkflowManager(components.workflow, {
	workpoolOptions: {
		maxParallelism: 10,
		defaultRetryBehavior: {
			maxAttempts: 5,
			initialBackoffMs: 1000,
			base: 2,
		},
		retryActionsByDefault: false,
	},
});

const eventType = v.union(
	v.literal("user.created"),
	v.literal("user.updated"),
	v.literal("user.deleted")
);

const lifecycleArgs = {
	clerkUserId: v.string(),
	eventType,
	email: v.optional(v.string()),
	firstName: v.optional(v.union(v.string(), v.null())),
	lastName: v.optional(v.union(v.string(), v.null())),
	imageUrl: v.optional(v.string()),
	clerkUpdatedAt: v.number(),
	// True only for genuine new signups via webhook — backfilled
	// existing users are provisioned without a welcome email.
	sendWelcome: v.optional(v.boolean()),
};

export const userLifecycle = workflow
	.define({ args: lifecycleArgs })
	.handler(async (step, args): Promise<void> => {
		if (args.eventType === "user.deleted") {
			const deleted = await step.runMutation(internal.users.softDelete, {
				clerkUserId: args.clerkUserId,
				clerkUpdatedAt: args.clerkUpdatedAt,
			});
			if (deleted.stale) {
				return;
			}
			await step.runAction(
				internal.polar.revokeBetaSubscription,
				{ clerkUserId: args.clerkUserId },
				{ retry: true }
			);
			return;
		}

		if (!args.email) {
			throw new Error(`Clerk event ${args.eventType} missing email`);
		}
		const upserted = await step.runMutation(internal.users.upsertFromClerk, {
			clerkUserId: args.clerkUserId,
			email: args.email,
			firstName: args.firstName,
			lastName: args.lastName,
			imageUrl: args.imageUrl,
			clerkUpdatedAt: args.clerkUpdatedAt,
		});
		if (upserted.stale) {
			return;
		}
		await step.runAction(
			internal.polar.ensureCustomer,
			{ clerkUserId: args.clerkUserId },
			{ retry: true }
		);
		await step.runAction(
			internal.polar.ensureBetaSubscription,
			{ clerkUserId: args.clerkUserId },
			{ retry: true }
		);
		await step.runMutation(internal.users.markProvisioned, {
			clerkUserId: args.clerkUserId,
		});
		if (args.sendWelcome) {
			// Best-effort: a failed welcome email must not mark the
			// (successfully provisioned) user as failed in onComplete.
			try {
				await step.runAction(
					internal.email.sendWelcome,
					{ clerkUserId: args.clerkUserId },
					{ retry: true }
				);
			} catch {
				// User stays "active"; email can be resent manually.
			}
		}
	});

export const handleOnComplete = internalMutation({
	args: {
		workflowId: vWorkflowId,
		result: vResultValidator,
		context: v.object({
			clerkUserId: v.string(),
			eventType,
		}),
	},
	handler: async (ctx, args): Promise<void> => {
		if (args.result.kind === "success") {
			return;
		}
		const message =
			args.result.kind === "failed"
				? args.result.error
				: `Workflow ${args.result.kind}`;
		await ctx.runMutation(internal.users.markFailed, {
			clerkUserId: args.context.clerkUserId,
			error: String(message),
		});
	},
});

export const enqueueUserEvent = internalMutation({
	args: lifecycleArgs,
	// No dedupe table: Svix duplicate deliveries may start a second
	// workflow, but every step is idempotent (upsert by clerkUserId,
	// Polar get-or-create by external_id / active-subscription check,
	// stale-event guard), so replays converge without extra storage.
	handler: async (ctx, args): Promise<{ workflowId: WorkflowId }> => {
		const workflowId = await workflow.start(
			ctx,
			internal.onboarding.userLifecycle,
			{
				clerkUserId: args.clerkUserId,
				eventType: args.eventType,
				email: args.email,
				firstName: args.firstName,
				lastName: args.lastName,
				imageUrl: args.imageUrl,
				clerkUpdatedAt: args.clerkUpdatedAt,
				sendWelcome: args.sendWelcome,
			},
			{
				onComplete: internal.onboarding.handleOnComplete,
				context: {
					clerkUserId: args.clerkUserId,
					eventType: args.eventType,
				},
			}
		);
		return { workflowId };
	},
});
