import { tool } from "ai";
import { guideStepsInput, guideStepsOutput } from "./schema";

export const guide_steps = tool({
	description: `Give the user a short batch of steps to follow, shown one at a time. Use when you know what the user should check or do next. For questions only the user can answer, use askUserQuestionnaire instead.

Batching:
- 1 to 4 steps. Batch only steps that do not depend on each other's results. If step 2 depends on what step 1 shows, send only step 1.
- Read-only diagnostic steps come first. Never put a fix step before its diagnosis.
- One goal per step. Max 3 commands per step. Prefer short commands over long pipelines. The user may be typing them by hand.

Each step:
- title: short imperative, for example "Check the link status."
- why: one sentence on what this step tests.
- instructions: plain actions, in order.
- commands: label, command, shell if it matters, and risk. Set risk to read_only, changes_system, or destructive. Every changes_system or destructive command MUST include an undo.
- expected.success: exactly what the user should see. expected.failureSigns: up to 3 common wrong outputs.
- capture: required if you must read their output, optional if helpful, none if the outcome alone is enough. Do not ask for pasted output you will not use.

Turn rules:
- Before calling this tool, stream one short paragraph explaining the next action and, when research ran, its useful finding. Add intro only if those findings have not already been explained. After calling this tool, your turn is over. The results arrive as the tool result.
- Results may be partial. The user may stop at any step, and you receive only the steps they reached.

Voice: short, calm, specific. No filler, no exclamation marks, no apologies, no em dashes. State uncertainty plainly. Examples:
- "Check the link status." not "Great question! Let's try this."
- "Read-only. Changes nothing." not "Run this command (safe!)"
- "That output doesn't match. Paste it and I'll narrow it down." not "Oops, something went wrong."
- "Two likely causes: driver or router. This step separates them." not "I think it might be the driver."`,
	inputSchema: guideStepsInput,
	outputSchema: guideStepsOutput,
});
