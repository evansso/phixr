import { z } from "zod";

export const resolutionInput = z.object({
	cause: z.string().min(1).max(300).describe("The most likely cause of the original problem, in plain language."),
	causeConfirmed: z.boolean().describe("True only when evidence confirms this cause. False means it is still the most likely explanation, not proven."),
	fixSummary: z.string().min(1).max(300).describe("What appears to have fixed the problem, in plain language."),
	changesMade: z.array(z.string().min(1).max(200)).max(5).optional().describe("System changes made during the case, if any."),
	ifItReturns: z.string().max(300).optional().describe("One short next step if the problem comes back."),
});

export const resolutionOutput = z.discriminatedUnion("status", [
	z.object({ status: z.literal("confirmed_fixed") }),
	z.object({ status: z.literal("still_broken") }),
	z.object({ status: z.literal("not_sure") }),
]);

export type ResolutionInput = z.infer<typeof resolutionInput>;
export type ResolutionOutput = z.infer<typeof resolutionOutput>;
