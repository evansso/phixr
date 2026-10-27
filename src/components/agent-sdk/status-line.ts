import type { UIMessage } from "ai";

export type ChatStatus = "submitted" | "streaming" | "ready" | "error";
export type StatusTrigger = "message" | "questionnaire" | "step_results";

export function hostOf(url?: string) {
	try {
		return new URL(url ?? "").hostname.replace(/^www\./, "");
	} catch {
		return "the page";
	}
}

export function statusLine(
	status: ChatStatus,
	last: UIMessage | undefined,
	trigger: StatusTrigger,
	elapsedMs: number
): string | null {
	if (status !== "submitted" && status !== "streaming") return null;
	if (elapsedMs > 20_000) return "Still working. This one needs more digging.";

	if (status === "submitted") {
		if (trigger === "questionnaire") return "Reading your answers";
		if (trigger === "step_results") return "Checking your results";
		return "Reading your message";
	}

	const parts = last?.role === "assistant" ? last.parts : [];
	const tail = parts.at(-1) as
		| { type?: string; toolName?: string; input?: unknown }
		| undefined;
	if (!tail || tail.type === "text") return tail ? null : "Planning the next move";

	const name = tail.toolName ?? (tail.type ?? "").replace(/^tool-/, "");
	const input = tail.input && typeof tail.input === "object"
		? tail.input as Record<string, unknown>
		: {};
	if (name === "askUserQuestionnaire") return "Preparing a few questions";
	if (name === "guide_steps") return "Writing your steps";
	if (name === "propose_resolution") return "Preparing your summary";
	if (name === "load_skill" || name === "frame") return "Thinking";
	if (name === "search_web" || name === "web_search") {
		return typeof input.purpose === "string" && input.purpose.trim()
			? input.purpose
			: "Searching the web";
	}
	if (name === "fetch_page" || name === "web_fetch") {
		return `Reading ${hostOf(typeof input.url === "string" ? input.url : undefined)}`;
	}
	return "Planning the next move";
}
