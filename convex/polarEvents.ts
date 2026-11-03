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

export const polarSync = workflow
	.define({
		args: { clerkUserId: v.string(), eventType: v.string() },
	})
	.handler(async (step, args): Promise<void> => {
		const user = await step.runQuery(internal.users.getByClerkId, {
			clerkUserId: args.clerkUserId,
		});
		if (!user || user.provisioningStatus === "deleted") {
			return;
		}
		const result = await step.runAction(
			internal.polar.syncCreditBalance,
			{ clerkUserId: args.clerkUserId },
			{ retry: true }
		);
		if (result === "no_meter") {
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
			await step.runAction(
				internal.polar.syncCreditBalance,
				{ clerkUserId: args.clerkUserId },
				{ retry: true }
			);
		}
	});

export const handleOnComplete = internalMutation({
	args: {
		workflowId: vWorkflowId,
		result: vResultValidator,
		context: v.object({
			clerkUserId: v.string(),
			eventType: v.string(),
		}),
	},
	handler: async (_ctx, args): Promise<void> => {
		if (args.result.kind === "success") {
			return;
		}
		console.error("Polar webhook sync workflow did not succeed", {
			clerkUserId: args.context.clerkUserId,
			eventType: args.context.eventType,
			result: args.result.kind,
		});
	},
});

export const enqueuePolarEvent = internalMutation({
	args: { clerkUserId: v.string(), eventType: v.string() },
	handler: async (ctx, args): Promise<{ workflowId: WorkflowId }> => {
		const workflowId = await workflow.start(
			ctx,
			internal.polarEvents.polarSync,
			{
				clerkUserId: args.clerkUserId,
				eventType: args.eventType,
			},
			{
				onComplete: internal.polarEvents.handleOnComplete,
				context: {
					clerkUserId: args.clerkUserId,
					eventType: args.eventType,
				},
			}
		);
		return { workflowId };
	},
});
