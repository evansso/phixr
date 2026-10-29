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
	if (elapsedMs > 20_000) return "This one's being a little stubborn. Digging deeper\u2026";

	if (status === "submitted") {
		if (trigger === "questionnaire") return "Connecting the dots\u2026";
		if (trigger === "step_results") return "Seeing what happened\u2026";
		return "Getting the full picture\u2026";
	}

	const parts = last?.role === "assistant" ? last.parts : [];
	const tail = parts.at(-1) as
		| { type?: string; toolName?: string; input?: unknown }
		| undefined;
	if (!tail || tail.type === "text") return tail ? null : "Figuring out our next move\u2026";

	const name = tail.toolName ?? (tail.type ?? "").replace(/^tool-/, "");
	const input = tail.input && typeof tail.input === "object"
		? tail.input as Record<string, unknown>
		: {};
	if (name === "askUserQuestionnaire") return "Let's narrow this down\u2026";
	if (name === "guide_steps") return "Turning clues into a game plan\u2026";
	if (name === "propose_resolution") return "Wrapping up our detective work\u2026";
	if (name === "load_skill") return "Getting the right tools for the job\u2026";
	if (name === "frame") return "Connecting the dots\u2026";
	if (name === "search_web" || name === "web_search") {
		return typeof input.purpose === "string" && input.purpose.trim()
			? input.purpose
			: "Looking for clues\u2026";
	}
	if (name === "fetch_page" || name === "web_fetch") {
		const host = hostOf(typeof input.url === "string" ? input.url : undefined);
		return host === "the page" ? "Taking a closer look\u2026" : `Checking ${host}'s guidance\u2026`;
	}
	return "Figuring out our next move\u2026";
}
