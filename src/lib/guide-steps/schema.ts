import { z } from "zod";

export const commandSchema = z.object({
	label: z.string().min(1).max(80),
	command: z.string().min(1).max(300),
	shell: z.enum(["bash", "zsh", "powershell", "cmd"]).optional(),
	risk: z.enum(["read_only", "changes_system", "destructive"]),
	undo: z.string().max(300).optional(),
});

export const stepSchema = z.object({
	id: z.string().min(1).max(40),
	title: z.string().min(1).max(80),
	kind: z.enum(["diagnose", "fix", "verify", "manual"]),
	why: z.string().min(1).max(160),
	instructions: z.array(z.string().min(1).max(200)).min(1).max(5),
	commands: z.array(commandSchema).max(3).optional(),
	expected: z.object({
		success: z.string().min(1).max(300),
		failureSigns: z.array(z.string().min(1).max(160)).max(3).optional(),
	}),
	capture: z.enum(["required", "optional", "none"]),
	capturePrompt: z.string().max(120).optional(),
});

export const guideStepsInput = z.object({
	intro: z.string().max(400).optional().describe("Optional research summary when findings and the next action have not already been explained in streamed text. Do not repeat that update. No questions."),
	planNote: z.string().max(160).optional(),
	steps: z.array(stepSchema).min(1).max(4),
});

export const stepResultSchema = z.object({
	stepId: z.string(),
	outcome: z.enum([
		"matched_expected",
		"different_result",
		"error",
		"could_not_run",
		"needs_help",
		"interrupted",
	]),
	pastedOutput: z.string().optional(),
	note: z.string().max(500).optional(),
});

export const guideStepsOutput = z.object({
	results: z.array(stepResultSchema),
	stoppedReason: z.enum([
		"batch_complete",
		"needs_model",
		"user_skipped",
		"interrupted",
	]),
});

export type Step = z.infer<typeof stepSchema>;
export type GuideStepsInput = z.infer<typeof guideStepsInput>;
export type StepResult = z.infer<typeof stepResultSchema>;
export type GuideStepsOutput = z.infer<typeof guideStepsOutput>;
