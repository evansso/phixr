import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
	useChatActions,
	useChatError,
	useChatMessages,
	useChatStatus,
} from "@ai-sdk-tools/store";
import { MessageScrollerItem } from "#/components/ui/message-scroller";
import { AssistantMessage, AssistantStatusMessage } from "./assistant-message";
import { UserMessage } from "./user-message";
import { statusLine, type ChatStatus, type StatusTrigger } from "./status-line";

function statusTrigger(messages: UIMessage[]): StatusTrigger {
	const last = messages.at(-1);
	if (last?.role === "user" && last.metadata && typeof last.metadata === "object") {
		const turn = (last.metadata as { questionnaireTurn?: { toolCallId?: string } }).questionnaireTurn;
		if (turn?.toolCallId) return "questionnaire";
	}
	if (last?.role !== "assistant") return "message";
	const lastAssistant = messages.findLast((message) => message.role === "assistant");
	const guideSteps = lastAssistant?.parts.findLast((part) => {
		const tool = part as { type?: string; toolName?: string; state?: string };
		return (tool.toolName ?? tool.type?.replace(/^tool-/, "")) === "guide_steps" && tool.state === "output-available";
	});
	return guideSteps ? "step_results" : "message";
}

export function AgentMessageList({
	messages: messageOverride,
	sessionId,
	isStreaming: streamingOverride,
	onRetry,
	emptyState,
}: {
	messages?: UIMessage[];
	sessionId?: string;
	isStreaming?: boolean;
	onRetry?: () => void;
	emptyState?: ReactNode;
}) {
	const storedMessages = useChatMessages<UIMessage>();
	const status = useChatStatus();
	const storedError = useChatError();
	const [elapsedMs, setElapsedMs] = useState(0);
	const activeSinceRef = useRef<number | null>(null);
	const { sendMessage, regenerate } = useChatActions();
	const sourceMessages = messageOverride ?? storedMessages;
	const uniqueMessages = Array.from(new Map(sourceMessages.map((message) => [message.id, message])).values());
	const latestAnswerMessage = new Map<string, string>();
	for (const message of uniqueMessages) {
		if (message.role !== "user" || !message.metadata || typeof message.metadata !== "object") continue;
		const turn = (message.metadata as { questionnaireTurn?: { toolCallId?: string } }).questionnaireTurn;
		if (turn?.toolCallId) latestAnswerMessage.set(turn.toolCallId, message.id);
	}
	const messages = uniqueMessages.filter((message) => {
		if (message.role !== "user" || !message.metadata || typeof message.metadata !== "object") return true;
		const turn = (message.metadata as { questionnaireTurn?: { toolCallId?: string } }).questionnaireTurn;
		return !turn?.toolCallId || latestAnswerMessage.get(turn.toolCallId) === message.id;
	});
	const previousMessageIds = useRef<Set<string> | null>(null);
	const enteringUserMessageId = previousMessageIds.current
		? [...messages].reverse().find(
				(message) => message.role === "user" && !previousMessageIds.current?.has(message.id)
			)?.id ?? null
		: null;
	previousMessageIds.current = new Set(messages.map((message) => message.id));
	const isStreaming = streamingOverride ?? (status === "submitted" || status === "streaming");
	const statusActive = status === "submitted" || status === "streaming";
	useEffect(() => {
		if (!statusActive) {
			activeSinceRef.current = null;
			setElapsedMs(0);
			return;
		}
		activeSinceRef.current ??= Date.now();
		const updateElapsed = () => setElapsedMs(Date.now() - (activeSinceRef.current ?? Date.now()));
		updateElapsed();
		const interval = setInterval(updateElapsed, 1000);
		return () => clearInterval(interval);
	}, [statusActive]);
	const currentStatusLine = statusLine(status as ChatStatus, messages.at(-1), statusTrigger(messages), elapsedMs);
	const waitingOnUser = messages.at(-1)?.role === "assistant" && messages.at(-1)?.parts.some((part) => {
		const tool = part as { type?: string; toolName?: string; state?: string };
		const name = tool.toolName ?? tool.type?.replace(/^tool-/, "");
		return (name === "askUserQuestionnaire" || name === "guide_steps" || name === "propose_resolution") && tool.state !== "output-available" && tool.state !== "output-error";
	});
	const hasError = !waitingOnUser && Boolean(storedError);
	const retry = onRetry ?? (() => {
		const latest = messages.at(-1);
		if (latest?.role === "assistant") {
			void regenerate({ messageId: latest.id });
		} else if (latest?.role === "user") {
			// Re-submit the saved user message with its original ID. The API treats
			// this as an idempotent retry instead of adding a duplicate turn.
			void sendMessage({
				role: "user",
				parts: latest.parts,
				metadata: latest.metadata,
				messageId: latest.id,
			});
		}
	});
	const latestIndex = messages.length - 1;
	const latestActionMessage = new Map<string, string>();
	const questionnaireTurnStatuses = new Map<string, "submitted" | "skipped">();
	const assistantTurnByMessage = new Map<string, number>();
	let assistantTurn = 0;
	for (const message of messages) {
		if (message.role === "user") assistantTurn += 1;
		assistantTurnByMessage.set(message.id, assistantTurn);
		if (message.role === "user" && message.metadata && typeof message.metadata === "object") {
			const turn = (message.metadata as { questionnaireTurn?: { toolCallId?: string; status?: "submitted" | "skipped" } }).questionnaireTurn;
			if (turn?.toolCallId && turn.status) questionnaireTurnStatuses.set(turn.toolCallId, turn.status);
		}
		for (const part of message.parts) {
			const toolPart = part as { type?: string; toolName?: string; toolCallId?: string };
			const name = toolPart.toolName ?? toolPart.type?.replace(/^tool-/, "");
			if ((name === "askUserQuestionnaire" || name === "guide_steps") && toolPart.toolCallId) {
				latestActionMessage.set(`${assistantTurn}:${name}`, message.id);
			}
		}
	}
	return (
		<>
			{messages.length === 0 && emptyState ? (
				<MessageScrollerItem className="flex min-h-full flex-1 items-center justify-center">
					{emptyState}
				</MessageScrollerItem>
			) : null}
			{messages.map((message, index) => {
				const metadata = message.metadata as
					| { createdAt?: string | number | Date }
					| undefined;
				const dateValue = metadata?.createdAt;
				const createdAt = dateValue
					? dateValue instanceof Date
						? new Date(dateValue.getTime())
						: new Date(dateValue)
					: undefined;
				const validCreatedAt =
					createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : undefined;
				const streaming = isStreaming && index === latestIndex;

				return (
					<MessageScrollerItem
						key={message.id}
						messageId={message.id}
						scrollAnchor={message.role === "user"}
					>
						{message.role === "user" ? (
							<UserMessage
								createdAt={validCreatedAt}
								animateEntry={message.id === enteringUserMessageId}
								message={message}
								disabled={isStreaming}
							/>
						) : (
							<AssistantMessage
								createdAt={validCreatedAt}
								isStreaming={streaming}
								message={message}
								statusText={streaming ? currentStatusLine ?? undefined : undefined}
								sessionId={sessionId ?? ""}
								hiddenActionCallIds={new Set(message.parts.flatMap((part) => {
									const toolPart = part as { type?: string; toolName?: string; toolCallId?: string };
									const name = toolPart.toolName ?? toolPart.type?.replace(/^tool-/, "");
									const turn = assistantTurnByMessage.get(message.id);
									return (name === "askUserQuestionnaire" || name === "guide_steps") && toolPart.toolCallId && turn !== undefined && latestActionMessage.get(`${turn}:${name}`) !== message.id ? [toolPart.toolCallId] : [];
								}))}
								questionnaireTurnStatuses={questionnaireTurnStatuses}
							/>
						)}
					</MessageScrollerItem>
				);
			})}
			{isStreaming && messages.at(-1)?.role === "user" ? (
				<MessageScrollerItem>
					<AssistantStatusMessage mode="thinking" text={currentStatusLine ?? undefined} />
				</MessageScrollerItem>
			) : null}
			{hasError ? (
				<MessageScrollerItem>
					<AssistantStatusMessage mode="error" onRetry={retry} />
				</MessageScrollerItem>
			) : null}
		</>
	);
}

export const MessageList = AgentMessageList;
