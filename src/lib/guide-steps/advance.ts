import type { Step, StepResult } from "./schema";

export function shouldReturnToModel(
	step: Step,
	result: StepResult,
	isLast: boolean
): boolean {
	return (
		isLast ||
		result.outcome !== "matched_expected" ||
		Boolean(result.pastedOutput?.trim()) ||
		step.kind === "fix"
	);
}

export function stoppedReasonFor(
	result: StepResult,
	isLast: boolean
): "batch_complete" | "needs_model" {
	return isLast && result.outcome === "matched_expected"
		? "batch_complete"
		: "needs_model";
}
