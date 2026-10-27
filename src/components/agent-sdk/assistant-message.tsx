import { isToolUIPart, type UIMessage } from "ai";
import { Brain, Globe, RotateCcwIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useChatActions } from "@ai-sdk-tools/store";
import { ChatMessage } from "#/components/chat/chat-message";
import { Button } from "#/components/ui/button";
import { ShimmerText } from "#/components/shimmer-text";
import { AssistantMessageActions } from "./assistant-message-actions";
import { QuestionnaireAskedStatus, QuestionnaireCard } from "./questionnaire-card";
import type { Questionnaire, ToolOutput } from "#/lib/questionnaire/schema";
import { ResolutionCard, ResolutionSummary } from "./resolution-card";
import type { ResolutionInput, ResolutionOutput } from "#/lib/resolution/schema";
import { GuideStepsCard } from "#/components/GuideStepsCard";
import { GuideStepsSummary } from "#/components/GuideStepsSummary";
import { ScrollArea } from "#/components/ui/scroll-area";
import type { GuideStepsInput, GuideStepsOutput } from "#/lib/guide-steps/schema";
import { hostOf } from "./status-line";

type ActivityPart = {
	type: string;
	toolName?: string;
	state?: string;
	preliminary?: boolean;
	input?: unknown;
	output?: unknown;
};

type FlowItem = {
	key: string;
	index: number;
	kind: "text" | "activity" | "action" | "label";
	text?: string;
	node?: ReactNode;
	pending?: boolean;
	awaitingUser?: boolean;
};

function toolIcon(part: ActivityPart) {
	const rawName = part.toolName ?? part.type.replace(/^tool-/, "");
	const normalizedName = rawName.toLowerCase().replaceAll("_", "");
	if (normalizedName === "memorysearch" || normalizedName === "memoryremember") {
		return <Brain aria-hidden="true" className="size-3.5 shrink-0" />;
	}
	if (["searchweb", "websearch", "fetchpage", "webfetch"].includes(normalizedName)) {
		return <Globe aria-hidden="true" className="size-3.5 shrink-0" />;
	}
	return null;
}

function toolLabel(part: ActivityPart, pending: boolean) {
	const rawName = part.toolName ?? part.type.replace(/^tool-/, "");
	const normalizedName = rawName.toLowerCase().replaceAll("_", "");
	if (normalizedName === "memorysearch" || normalizedName === "memoryremember") {
		return pending ? "Remembering" : "Remembered";
	}
	const name = rawName
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replaceAll("_", " ");
	const input =
		part.input && typeof part.input === "object"
			? (part.input as Record<string, unknown>)
			: {};
	if (normalizedName === "searchweb") {
		return typeof input.purpose === "string" && input.purpose.trim()
			? input.purpose
			: "Searching the web";
	}
	if (normalizedName === "fetchpage") {
		const focus = typeof input.focus === "string" ? input.focus.trim() : "";
		return focus || `Reading ${hostOf(typeof input.url === "string" ? input.url : undefined)}`;
	}
	const detail =
		typeof input.query === "string"
			? input.query
			: typeof input.url === "string"
				? input.url
				: typeof input.search_query === "string"
					? input.search_query
					: null;
	return detail ? `${name}: ${detail}` : name;
}

function researchSource(url: string, title: string) {
	try {
		const hostname = new URL(url).hostname.replace(/^www\./, "");
		return <a className="flex w-full max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted" href={url} key={url} rel="noreferrer" target="_blank"><img alt="" className="size-5 shrink-0 rounded-md border bg-background object-cover" loading="lazy" src={`https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=64`} /><span className="min-w-0 flex-1 truncate text-foreground" title={title || hostname}>{title || hostname}</span><span className="max-w-[35%] shrink-0 truncate text-xs text-muted-foreground" title={hostname}>{hostname}</span></a>;
	} catch { return null; }
}

export function AssistantStatusMessage({
	mode,
	text,
	onRetry,
}: {
	mode: "thinking" | "continuing" | "error";
	text?: string;
	onRetry?: () => void;
}) {
	if (mode === "thinking") {
		return (
			<p aria-label="Agent is responding" className="text-sm">
				<ShimmerText>{text ?? "Thinking"}</ShimmerText>
			</p>
		);
	}
	if (mode === "continuing") {
		return (
			<p aria-label="Continuing this conversation" className="text-sm">
				<ShimmerText>Continuing this conversation</ShimmerText>
			</p>
		);
	}

	return (
		<div className="flex flex-col items-start gap-2">
			<p className="text-muted-foreground text-sm">
				An error occurred while the assistant was responding.
			</p>
			<Button onClick={onRetry} size="xs" variant="outline">
				<RotateCcwIcon className="size-3.5" />
				Retry
			</Button>
		</div>
	);
}

export function AssistantMessage({
	message,
	createdAt,
	isStreaming,
	hiddenActionCallIds,
	questionnaireTurnStatuses,
	sessionId,
	statusText,
}: {
	message: UIMessage;
	createdAt?: Date;
	isStreaming: boolean;
	hiddenActionCallIds?: Set<string>;
	questionnaireTurnStatuses?: ReadonlyMap<string, "submitted" | "skipped">;
	sessionId: string;
	statusText?: string;
}) {
	const { regenerate, addToolResult, sendMessage } = useChatActions();
	const [revealComplete, setRevealComplete] = useState(!isStreaming);
	const actionTopRef = useRef<HTMLDivElement>(null);
	const previousActionCount = useRef(0);

	useEffect(() => {
		if (isStreaming) setRevealComplete(false);
		else setRevealComplete(true);
	}, [isStreaming]);
	const isSkillLoader = (part: ActivityPart) =>
		(part.toolName ?? part.type.replace(/^tool-/, "")).toLowerCase().replaceAll("_", "") === "loadskill";
	const isSummaryTool = (part: ActivityPart) =>
		(part.toolName ?? part.type.replace(/^tool-/, "")) === "submit_summary";
	const parts = message.parts as Array<(typeof message.parts)[number] & ActivityPart>;
	const lastActionIndex = new Map<string, number>();
	parts.forEach((part, index) => {
		const name = part.toolName ?? part.type.replace(/^tool-/, "");
		if (name === "askUserQuestionnaire" || name === "guide_steps" || name === "propose_resolution") {
			lastActionIndex.set(name, index);
		}
	});
	const shownQuestionnaires = new Set<string>();

	// One flow, in the order the model produced it: streamed text,
	// inline tool activity (status + sources), then the next text or
	// card. Nothing is grouped into a collapsible.
	const flow: FlowItem[] = [];
	for (const [index, part] of parts.entries()) {
		if (part.type === "text") {
			if (part.text) flow.push({ key: `text-${index}`, index, kind: "text", text: part.text });
			continue;
		}
		if (part.type === "reasoning" || part.type === "step-start") continue;
		if (!isToolUIPart(part) && (part.type as string) !== "dynamic-tool") continue;
		const info = part as ActivityPart & { toolCallId: string };
		const name = info.toolName ?? info.type.replace(/^tool-/, "");
		if (isSkillLoader(info) || isSummaryTool(info) || name === "frame") continue;
		if (name === "reply") {
			// Legacy turns delivered the final answer through a reply tool.
			const input = info.input && typeof info.input === "object" ? info.input as Record<string, unknown> : {};
			if (typeof input.message === "string") flow.push({ key: `reply-${info.toolCallId}`, index, kind: "text", text: input.message });
			continue;
		}
		if ((name === "askUserQuestionnaire" || name === "guide_steps" || name === "propose_resolution") && lastActionIndex.get(name) !== index) continue;

		if (name === "askUserQuestionnaire") {
			if (shownQuestionnaires.has(info.toolCallId) || hiddenActionCallIds?.has(info.toolCallId)) continue;
			shownQuestionnaires.add(info.toolCallId);
			const recordedStatus = questionnaireTurnStatuses?.get(info.toolCallId);
			const outputStatus = info.state === "output-available" && info.output && typeof info.output === "object"
				? (info.output as ToolOutput).status
				: undefined;
			// Answered or skipped: the interactive card is gone. This
			// message keeps only a small label; the answers themselves
			// arrive as the next user message.
			if (recordedStatus ?? outputStatus) {
				flow.push({
					key: info.toolCallId,
					index,
					kind: "label",
					node: <QuestionnaireAskedStatus status={(recordedStatus ?? outputStatus) as "submitted" | "skipped"} />,
				});
				continue;
			}
			const finishQuestionnaire = async (output: ToolOutput, answerMessage: import("#/lib/questionnaire/schema").PersistedAnswerMessage) => {
				await addToolResult({ tool: "askUserQuestionnaire", toolCallId: info.toolCallId, output } as never);
				// Append, do not pass messageId: sendMessage treats messageId
				// as replace-an-existing-message and throws when the ID is
				// not already in local state. The Convex-saved answer message
				// only exists server-side, so give the new local user message
				// the same stable ID and let it append, which also triggers
				// the next model turn.
				await sendMessage({
					id: answerMessage.id,
					role: "user",
					parts: [{ type: "text", text: answerMessage.text }],
					metadata: answerMessage.metadata,
				});
			};
			if (info.state === "input-streaming") {
				flow.push({ key: info.toolCallId, index, kind: "activity", pending: true, node: <p className="text-sm"><ShimmerText>Preparing a few questions</ShimmerText></p> });
			} else if (info.state === "input-available" && info.input) {
				const input = info.input as Questionnaire;
				flow.push({
					key: info.toolCallId,
					index,
					kind: "action",
					awaitingUser: true,
					node: <>
						{input.intro ? <p className="mb-2 text-sm leading-relaxed">{input.intro}</p> : null}
						{isStreaming
							? <p className="text-sm"><ShimmerText>Preparing questions</ShimmerText></p>
							: <QuestionnaireCard input={input} onDone={(output, answerMessage) => finishQuestionnaire(output, answerMessage)} sessionId={sessionId} toolCallId={info.toolCallId} />}
					</>,
				});
			}
			continue;
		}
		if (name === "guide_steps") {
			if (info.state === "input-streaming") {
				flow.push({ key: info.toolCallId, index, kind: "activity", pending: true, node: <p className="text-sm"><ShimmerText>Writing your steps</ShimmerText></p> });
			} else if (info.state === "input-available" && info.input) {
				const input = info.input as GuideStepsInput;
				flow.push({ key: info.toolCallId, index, kind: "action", awaitingUser: true, node: <>{input.intro ? <p className="mb-2 text-sm leading-relaxed">{input.intro}</p> : null}<GuideStepsCard input={input} onDone={(output) => addToolResult({ tool: "guide_steps", toolCallId: info.toolCallId, output } as never)} sessionId={sessionId} toolCallId={info.toolCallId} /></> });
			} else if (info.state === "output-available" && info.input && info.output) {
				flow.push({ key: info.toolCallId, index, kind: "action", node: <GuideStepsSummary input={info.input as GuideStepsInput} output={info.output as GuideStepsOutput} /> });
			}
			continue;
		}
		if (name === "propose_resolution") {
			if (info.state === "input-streaming") {
				flow.push({ key: info.toolCallId, index, kind: "activity", pending: true, node: <p className="text-sm"><ShimmerText>Preparing your summary</ShimmerText></p> });
			} else if (info.state === "input-available" && info.input) {
				const input = info.input as ResolutionInput;
				flow.push({ key: info.toolCallId, index, kind: "action", awaitingUser: true, node: <ResolutionCard input={input} onDone={(output) => addToolResult({ tool: "propose_resolution", toolCallId: info.toolCallId, output } as never)} sessionId={sessionId} /> });
			} else if (info.state === "output-available" && info.input && info.output) {
				flow.push({ key: info.toolCallId, index, kind: "action", node: <ResolutionSummary input={info.input as ResolutionInput} output={info.output as ResolutionOutput} /> });
			}
			continue;
		}

		// Research and any other visible tool: status line first, then
		// its content (sources) directly underneath, inline in the flow.
		const pending = info.state !== "output-error" && (info.state !== "output-available" || info.preliminary === true);
		const label = toolLabel(info, pending);
		const purpose = info.input && typeof info.input === "object" ? (info.input as Record<string, unknown>).purpose ?? (info.input as Record<string, unknown>).focus : null;
		const activityStatus = typeof purpose === "string" && purpose.trim() ? purpose : label;
		const output = info.output && typeof info.output === "object" ? info.output as { results?: Array<{url?: string; title?: string}>; error?: string } : {};
		const results = output.results ?? [];
		const sources = results.flatMap((source) => {
			if (!source.url) return [];
			const element = researchSource(source.url, source.title ?? source.url);
			return element ? [element] : [];
		});
		const resultCount = !pending && Array.isArray(output.results) ? output.results.length : null;
		flow.push({
			key: info.toolCallId,
			index,
			kind: "activity",
			pending,
			node: <div className="flex min-w-0 flex-col gap-2">
				<p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
					{toolIcon(info)}
					<span className="min-w-0 flex-1 truncate">{pending ? <ShimmerText>{activityStatus}</ShimmerText> : activityStatus}</span>
					{resultCount !== null ? <span className="shrink-0 text-xs tabular-nums">{resultCount} {resultCount === 1 ? "result" : "results"}</span> : null}
				</p>
				{sources.length ? <ScrollArea className="h-[150px] w-full rounded-lg border bg-background" scrollbarGutter><div className="px-4 py-2"><ul className="flex flex-col gap-2">{sources.map((source) => <li key={source.key}>{source}</li>)}</ul></div></ScrollArea> : output.error || info.state === "output-error" ? <p className="text-sm text-muted-foreground">Couldn't reach the docs. Continuing with what I know.</p> : pending ? null : <div className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">No sources found.</div>}
			</div>,
		});
	}

	const actionCount = flow.filter((item) => item.kind === "action").length;
	useEffect(() => {
		if (isStreaming && actionCount > previousActionCount.current) {
			actionTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
		}
		previousActionCount.current = actionCount;
	}, [actionCount, isStreaming]);

	const lastFlowItem = flow.at(-1);
	const showThinkingStatus = isStreaming &&
		!flow.some((item) => item.pending || item.awaitingUser) &&
		(!lastFlowItem || lastFlowItem.kind === "activity" || lastFlowItem.kind === "label");
	const lastTextKey = [...flow].reverse().find((item) => item.kind === "text")?.key;
	const fullText = flow.filter((item) => item.kind === "text").map((item) => item.text ?? "").join("");
	const firstActionKey = flow.find((item) => item.kind === "action")?.key;

	return (
		<div className="group flex w-full flex-col gap-3">
			{flow.map((item) => item.kind === "text"
				? <ChatMessage key={item.key} isStreaming={isStreaming && item.key === lastTextKey} onRevealComplete={item.key === lastTextKey ? setRevealComplete : undefined} role="assistant" text={item.text ?? ""} />
				: <div key={item.key} ref={item.key === firstActionKey ? actionTopRef : undefined}>{item.node}</div>)}
			{showThinkingStatus ? <AssistantStatusMessage mode="thinking" text={statusText} /> : null}
			{!isStreaming && revealComplete && flow.length > 0 ? (
				<AssistantMessageActions
					createdAt={createdAt}
					onRedo={() => void regenerate({ messageId: message.id })}
					text={fullText}
				/>
			) : null}
		</div>
	);
}
