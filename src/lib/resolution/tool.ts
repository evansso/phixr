import { tool } from "ai";
import { resolutionInput, resolutionOutput } from "./schema";

export const propose_resolution = tool({
	description: `Propose closing the case with a summary card and ask the user to confirm the original problem is fixed. Use only after verification: a verify step matched, or the user reports the original symptom is gone. The card shows the likely cause, what fixed it, changes made, and what to do if it returns, with three user choices: It's fixed, Still happening, Not sure yet.

Turn rules:
- The streamed text earlier in your turn already says the original problem looks resolved. Call this tool directly, with no text announcing the summary. Do not declare the case resolved in text: only the user's confirmation marks it resolved.
- If the user confirms, close with one brief plain-text message. If they say it is still happening, treat that as new evidence and keep troubleshooting. If they are not sure, offer a concrete verification step.
- Never use this tool merely because a sequence of steps ended. A finished step batch is not a verified fix.`,
	inputSchema: resolutionInput,
	outputSchema: resolutionOutput,
});
