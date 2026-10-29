import { isToolUIPart, type UIMessage } from "ai";
import { Brain, Check, ChevronDown, CircleHelp, Flag, Globe, ListChecks, RotateCcwIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "#/lib/utils";
import { PhixrIcon } from "#/components/phixr-icon";
import { Spinner } from "#/components/spinner";
import { motion } from "motion/react";
import { useChatActions } from "@ai-sdk-tools/store";
import { ChatMessage } from "#/components/chat/chat-message";
import { Button } from "#/components/ui/button";
import { ShimmerText } from "#/components/shimmer-text";
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
	icon?: ReactNode;
	pending?: boolean;
	awaitingUser?: boolean;
};

/** Left rail node: a bare icon on the line, no box. While a step is
 * live the icon is replaced by the Trace spinner. */
function FlowNode({ icon, pending, awaitingUser }: { icon?: ReactNode; pending?: boolean; awaitingUser?: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"relative z-10 grid size-7 shrink-0 place-items-center bg-background text-muted-foreground",
				awaitingUser && "text-foreground"
			)}
		>
			{pending ? <Spinner size={18} /> : icon ?? <PhixrIcon className="size-3.5" />}
		</span>
	);
}

/**
 * One finished activity on the rail. While pending it is only a shimmering
 * label; once done it collapses to a single row the user can open to see
 * what actually happened (sources, counts, …). Closed by default.
 */
function CollapsibleActivity({
	label,
	pending,
	meta,
	hasDetail,
	children,
}: {
	label: string;
	pending?: boolean;
	meta?: string;
	hasDetail?: boolean;
	children?: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	if (pending) {
		return (
			<p className="flex min-h-7 items-center text-sm">
				<ShimmerText>{label}</ShimmerText>
			</p>
		);
	}
	if (!hasDetail) {
		return (
			<p className="flex min-h-7 items-center gap-2 text-sm text-muted-foreground">
				<span className="min-w-0 flex-1 truncate">{label}</span>
				{meta ? <span className="shrink-0 text-xs tabular-nums">{meta}</span> : null}
			</p>
		);
	}
	return (
		<div className="min-w-0">
			<button
				aria-expanded={open}
				className="flex min-h-7 w-full items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
				onClick={() => setOpen((value) => !value)}
				type="button"
			>
				<span className="min-w-0 flex-1 truncate">{label}</span>
				{meta ? <span className="shrink-0 text-xs tabular-nums">{meta}</span> : null}
				<ChevronDown aria-hidden="true" className={cn("size-3.5 shrink-0 transition-transform duration-[260ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]", open && "rotate-180")} />
			</button>
			{/* One animation only: height on a single material-standard
			    curve. Stacking an opacity fade on a different curve, or
			    a short ease-out that starts fast and snaps shut, is what
			    made this feel rough. Content stays mounted (clipped) so
			    closing animates too, not just opening. */}
			<div
				aria-hidden={!open}
				inert={!open}
				className={cn(
					"grid transition-[grid-template-rows] duration-[260ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]",
					open ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
				)}
			>
				<div className="overflow-hidden">
					<div className="pt-2">{children}</div>
				</div>
			</div>
		</div>
	);
}

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

function toolLabel(part: ActivityPart, pending: boolean, completed?: { resultCount?: number | null; hasError?: boolean }) {
	const rawName = part.toolName ?? part.type.replace(/^tool-/, "");
	const normalizedName = rawName.toLowerCase().replaceAll("_", "");
	if (normalizedName === "memorysearch") {
		return pending ? "Looking back for useful context…" : "Found something from earlier";
	}
	if (normalizedName === "memoryremember") {
		return pending ? "Keeping that in mind…" : "Remembered";
	}
	const name = rawName
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replaceAll("_", " ");
	const input =
		part.input && typeof part.input === "object"
			? (part.input as Record<string, unknown>)
			: {};
	if (normalizedName === "searchweb" || normalizedName === "websearch") {
		if (pending) {
			return typeof input.purpose === "string" && input.purpose.trim()
				? input.purpose
				: "Looking for clues…";
		}
		if (completed?.hasError || part.state === "output-error") return "Couldn't look for clues";
		const count = completed?.resultCount;
		if (count === 0) return "No useful sources found";
		return count != null
			? `Found ${count} useful ${count === 1 ? "source" : "sources"}`
			: "Looked for clues";
	}
	if (normalizedName === "fetchpage" || normalizedName === "webfetch") {
		const host = hostOf(typeof input.url === "string" ? input.url : undefined);
		if (pending) return host === "the page" ? "Taking a closer look…" : `Checking ${host}'s guidance…`;
		if (completed?.hasError || part.state === "output-error") return "Couldn't check that page";
		return host === "the page" ? "Took a closer look" : `Checked ${host}'s guidance`;
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
		return <a className="flex w-full max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-0.5 text-sm text-foreground transition-colors duration-300 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" href={url} key={url} rel="noreferrer" target="_blank"><img alt="" className="size-5 shrink-0 rounded-md border bg-background object-cover" loading="lazy" src={`https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=64`} /><span className="min-w-0 flex-1 truncate text-foreground" title={title || hostname}>{title || hostname}</span><span className="max-w-[35%] shrink-0 truncate text-xs text-muted-foreground" title={hostname}>{hostname}</span></a>;
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
			<div aria-label="Agent is responding" className="flex items-start gap-3">
				<FlowNode pending />
				<p className="flex min-h-7 items-center text-sm">
					<ShimmerText>{text ?? "Connecting the dots…"}</ShimmerText>
				</p>
			</div>
		);
	}
	if (mode === "continuing") {
		return (
			<div aria-label="Continuing this conversation" className="flex items-start gap-3">
				<FlowNode pending />
				<p className="flex min-h-7 items-center text-sm">
					<ShimmerText>Continuing this conversation</ShimmerText>
				</p>
			</div>
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
	const { addToolResult, sendMessage } = useChatActions();
	// Entry animation is armed only after the first commit, so steps
	// already on screen (history) never animate; only steps that appear
	// while the turn flows in ease in.
	const [entryArmed, setEntryArmed] = useState(false);
	useEffect(() => {
		setEntryArmed(true);
	}, []);
	const actionTopRef = useRef<HTMLDivElement>(null);
	const previousActionCount = useRef(0);

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

	// One timeline, in the order the model produced it: a node on the
	// left rail per step — streamed text, tool activity, then the next
	// text or card. Live steps shimmer; finished activities collapse to
	// a closed row the user can open.
	const flow: FlowItem[] = [];
	for (const [index, part] of parts.entries()) {
		if (part.type === "text") {
			if (part.text) flow.push({ key: `text-${index}`, index, kind: "text", text: part.text, icon: <PhixrIcon className="size-3.5" /> });
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
				const effectiveStatus = (recordedStatus ?? outputStatus) as "submitted" | "skipped";
				const submittedAnswers = info.state === "output-available" && info.output && typeof info.output === "object" && (info.output as ToolOutput).status === "submitted"
					? (info.output as Extract<ToolOutput, { status: "submitted" }>).answers
					: undefined;
				const questionCount = info.input && typeof info.input === "object"
					? (info.input as Questionnaire).questions?.length
					: undefined;
				const answerCount = effectiveStatus === "submitted"
					? submittedAnswers?.length ?? questionCount
					: undefined;
				flow.push({
					key: info.toolCallId,
					index,
					kind: "label",
					icon: <Check aria-hidden="true" className="size-3.5 shrink-0" />,
					node: <div className="flex min-h-7 items-center"><QuestionnaireAskedStatus count={answerCount} status={effectiveStatus} /></div>,
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
			const questionnaireIcon = <CircleHelp aria-hidden="true" className="size-3.5 shrink-0" />;
			if (info.state === "input-streaming" || (info.state === "input-available" && isStreaming)) {
				flow.push({ key: info.toolCallId, index, kind: "activity", pending: true, icon: questionnaireIcon, node: <CollapsibleActivity label="Let's narrow this down…" pending /> });
			} else if (info.state === "input-available" && info.input) {
				const input = info.input as Questionnaire;
				// The preparing step collapses shut, then the card itself
				// becomes the next, ringed step on the rail.
				flow.push({
					key: `${info.toolCallId}-prepared`,
					index,
					kind: "activity",
					icon: questionnaireIcon,
					node: <CollapsibleActivity hasDetail label="Prepared questions" meta={`${input.questions.length} ${input.questions.length === 1 ? "question" : "questions"}`}><p className="text-xs leading-relaxed text-muted-foreground">{input.questions.length} {input.questions.length === 1 ? "question" : "questions"} ready below.</p></CollapsibleActivity>,
				});
				flow.push({
					key: info.toolCallId,
					index,
					kind: "action",
					awaitingUser: true,
					icon: questionnaireIcon,
					node: <>
						{input.intro ? <p className="mb-2 text-sm leading-relaxed">{input.intro}</p> : null}
						<QuestionnaireCard input={input} onDone={(output, answerMessage) => finishQuestionnaire(output, answerMessage)} sessionId={sessionId} toolCallId={info.toolCallId} />
					</>,
				});
			}
			continue;
		}
		if (name === "guide_steps") {
			const guideIcon = <ListChecks aria-hidden="true" className="size-3.5 shrink-0" />;
			if (info.state === "input-streaming") {
				flow.push({ key: info.toolCallId, index, kind: "activity", pending: true, icon: guideIcon, node: <CollapsibleActivity label="Turning clues into a game plan…" pending /> });
			} else if (info.state === "input-available" && info.input) {
				const input = info.input as GuideStepsInput;
				flow.push({
					key: `${info.toolCallId}-prepared`,
					index,
					kind: "activity",
					icon: guideIcon,
					node: <CollapsibleActivity hasDetail label="Your next step is ready" meta={`${input.steps.length} ${input.steps.length === 1 ? "step" : "steps"}`}><p className="text-xs leading-relaxed text-muted-foreground">{input.planNote || "Follow the guide below, one step at a time."}</p></CollapsibleActivity>,
				});
				flow.push({ key: info.toolCallId, index, kind: "action", awaitingUser: true, icon: guideIcon, node: <>{input.intro ? <p className="mb-2 text-sm leading-relaxed">{input.intro}</p> : null}<GuideStepsCard input={input} onDone={(output) => addToolResult({ tool: "guide_steps", toolCallId: info.toolCallId, output } as never)} sessionId={sessionId} toolCallId={info.toolCallId} /></> });
			} else if (info.state === "output-available" && info.input && info.output) {
				flow.push({ key: info.toolCallId, index, kind: "action", icon: guideIcon, node: <GuideStepsSummary input={info.input as GuideStepsInput} output={info.output as GuideStepsOutput} /> });
			}
			continue;
		}
		if (name === "propose_resolution") {
			const resolutionIcon = <Flag aria-hidden="true" className="size-3.5 shrink-0" />;
			if (info.state === "input-streaming") {
				flow.push({ key: info.toolCallId, index, kind: "activity", pending: true, icon: resolutionIcon, node: <CollapsibleActivity label="Wrapping up our detective work…" pending /> });
			} else if (info.state === "input-available" && info.input) {
				const input = info.input as ResolutionInput;
				flow.push({
					key: `${info.toolCallId}-prepared`,
					index,
					kind: "activity",
					icon: resolutionIcon,
					node: <CollapsibleActivity label="Troubleshooting wrapped up" />,
				});
				flow.push({ key: info.toolCallId, index, kind: "action", awaitingUser: true, icon: resolutionIcon, node: <ResolutionCard input={input} onDone={(output) => addToolResult({ tool: "propose_resolution", toolCallId: info.toolCallId, output } as never)} sessionId={sessionId} /> });
			} else if (info.state === "output-available" && info.input && info.output) {
				flow.push({ key: info.toolCallId, index, kind: "action", icon: resolutionIcon, node: <ResolutionSummary input={info.input as ResolutionInput} output={info.output as ResolutionOutput} /> });
			}
			continue;
		}

		// Research and any other visible tool: shimmering label while it
		// runs, then a collapsed row; sources stay inside, closed by
		// default, until the user opens it.
		const pending = info.state !== "output-error" && (info.state !== "output-available" || info.preliminary === true);
		const output = info.output && typeof info.output === "object" ? info.output as { results?: Array<{url?: string; title?: string}>; url?: string; title?: string; error?: string } : {};
		const results = output.results ?? (output.url ? [{ url: output.url, title: output.title ?? output.url }] : []);
		const label = toolLabel(info, pending, {
			resultCount: Array.isArray(output.results) ? output.results.length : null,
			hasError: Boolean(output.error),
		});
		const purpose = info.input && typeof info.input === "object" ? (info.input as Record<string, unknown>).purpose : null;
		const activityStatus = pending && typeof purpose === "string" && purpose.trim() ? purpose : label;
		const sources = results.flatMap((source) => {
			if (!source.url) return [];
			const element = researchSource(source.url, source.title ?? source.url);
			return element ? [element] : [];
		});
		const isSearch = ["searchweb", "websearch"].includes(name.toLowerCase().replaceAll("_", ""));
		const resultCount = !pending && !isSearch && Array.isArray(output.results) ? output.results.length : null;
		flow.push({
			key: info.toolCallId,
			index,
			kind: "activity",
			pending,
			icon: toolIcon(info) ?? <Globe aria-hidden="true" className="size-3.5 shrink-0" />,
			node: <CollapsibleActivity
				hasDetail={!pending}
				label={activityStatus}
				meta={resultCount !== null ? `${resultCount} ${resultCount === 1 ? "result" : "results"}` : undefined}
				pending={pending}
			>
				{sources.length ? <ScrollArea className="h-[150px] w-full rounded-lg border bg-background" scrollbarGutter><div className="p-1.5"><ul className="flex flex-col gap-1">{sources.map((source) => <li key={source.key}>{source}</li>)}</ul></div></ScrollArea> : output.error || info.state === "output-error" ? <p className="text-sm text-muted-foreground">Couldn't reach the docs. Continuing with what I know.</p> : <div className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">No sources found.</div>}
			</CollapsibleActivity>,
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
	// Also cover the quiet gap after a text part finishes streaming
	// (state "done") while the turn is still open: no tool is running
	// and nothing is visibly happening, so show the status line.
	const tailPart = parts.at(-1) as { type?: string; state?: string } | undefined;
	const lastTextFinished = tailPart?.type === "text" && tailPart.state === "done";
	const showThinkingStatus = isStreaming &&
		!flow.some((item) => item.pending || item.awaitingUser) &&
		(!lastFlowItem || lastFlowItem.kind === "activity" || lastFlowItem.kind === "label" || (lastFlowItem.kind === "text" && lastTextFinished));
	const lastTextKey = [...flow].reverse().find((item) => item.kind === "text")?.key;
	const firstActionKey = flow.find((item) => item.kind === "action")?.key;

	return (
		<div className="group relative flex w-full flex-col">
			{flow.length > 1 ? <span aria-hidden="true" className="absolute top-3 bottom-3 left-[13px] w-px bg-border" /> : null}
			{flow.map((item) => (
				<motion.div
					animate={{ opacity: 1, y: 0 }}
					className="relative flex items-start gap-3 pb-4 last:pb-0"
					initial={entryArmed ? { opacity: 0, y: 8 } : false}
					key={item.key}
					ref={item.key === firstActionKey ? actionTopRef : undefined}
					transition={{ duration: 0.3, ease: "easeOut" }}
				>
					<FlowNode awaitingUser={item.awaitingUser} icon={item.icon} pending={item.pending} />
					<div className="min-w-0 flex-1">
						{item.kind === "text"
							? <div className="pt-0.5"><ChatMessage isStreaming={isStreaming && item.key === lastTextKey} role="assistant" text={item.text ?? ""} /></div>
							: item.node}
					</div>
				</motion.div>
			))}
			{showThinkingStatus ? (
				<motion.div
					animate={{ opacity: 1, y: 0 }}
					className="relative flex items-start gap-3 pt-1"
					initial={entryArmed ? { opacity: 0, y: 8 } : false}
					transition={{ duration: 0.3, ease: "easeOut" }}
				>
					<FlowNode pending />
					<p className="flex min-h-7 items-center text-sm"><ShimmerText>{statusText ?? "Connecting the dots…"}</ShimmerText></p>
				</motion.div>
			) : null}
		</div>
	);
}
