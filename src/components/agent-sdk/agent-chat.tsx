import { Provider, useChat, useDataPart } from "@ai-sdk-tools/store";
import { useAuth } from "@clerk/tanstack-react-start";
import { useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport, isToolUIPart, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { useConvexAuth, useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { api } from "../../../convex/_generated/api";
import { Spinner } from "#/components/spinner";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "#/components/ui/message-scroller";
import { cn } from "#/lib/utils";
import { AgentHeader } from "./agent-header";
import { AgentChatInput } from "./chat-input";
import { useChatSession } from "./chat-session-store";
import { EmptyState } from "./empty-state";
import { AgentMessageList } from "./message-list";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

const EMPTY_MESSAGES: UIMessage[] = [];
const chatDataPartSchemas = {
	"chat-title": z.object({ title: z.string() }),
};

function shouldContinueAfterToolResult({ messages }: { messages: UIMessage[] }) {
	const latestAssistant = messages.findLast((message) => message.role === "assistant");
	const waitingOnUser = latestAssistant?.parts.some(
		(part) => {
			const tool = part as UIMessage["parts"][number] & { toolName?: string; state?: string };
			const name = tool.toolName ?? tool.type.replace(/^tool-/, "");
			return (isToolUIPart(part) || tool.type === "dynamic-tool") &&
				(name === "askUserQuestionnaire" || name === "guide_steps") &&
				tool.state !== "output-available";
		}
	);
	if (waitingOnUser) return false;
	const questionnaireCompleted = latestAssistant?.parts.some((part) => {
		const tool = part as UIMessage["parts"][number] & { toolName?: string; state?: string };
		const name = tool.toolName ?? tool.type.replace(/^tool-/, "");
		return (isToolUIPart(part) || tool.type === "dynamic-tool") &&
			name === "askUserQuestionnaire" &&
			tool.state === "output-available";
	});
	if (questionnaireCompleted) return false;
	return lastAssistantMessageIsCompleteWithToolCalls({ messages });
}

export function AgentChat({
	children,
	className,
	chatId,
	initialMessages = [],
	initialTitle,
	isNewChat = false,
}: {
	children?: ReactNode;
	className?: string;
	chatId?: string;
	initialMessages?: UIMessage[];
	initialTitle?: string;
	isNewChat?: boolean;
}) {
	const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
	const setSessionMessages = useChatSession((state) => state.setMessages);
	const setSessionTitle = useChatSession((state) => state.setTitle);
	const resetKey = useChatSession((state) => state.resetKey);
	const activeSessionId = useChatSession((state) => state.sessionId);
	const sessionIsNew = useChatSession((state) => state.isNewChat);
	const pendingMessage = useChatSession((state) => state.pendingMessage);
	const setPendingMessage = useChatSession((state) => state.setPendingMessage);
	const isUnpersistedSession = Boolean(
		chatId &&
		sessionIsNew &&
		activeSessionId === chatId &&
		pendingMessage !== null
	);
	const queriedMessages = useQuery(
		api.messages.getChat,
		chatId && isAuthenticated && !isUnpersistedSession
			? { chatId }
			: "skip"
	);
	const messages =
		initialMessages.length > 0
			? initialMessages
			: queriedMessages?.messages ?? EMPTY_MESSAGES;
	const title = queriedMessages?.title ?? initialTitle ?? "New chat";
	const loadingMessages = Boolean(
		chatId &&
			!isUnpersistedSession &&
			(authLoading || (isAuthenticated && queriedMessages === undefined))
	);

	useEffect(() => {
		setSessionMessages(messages);
		setSessionTitle(title);
	}, [messages, setSessionMessages, setSessionTitle, title]);

	return (
		<Provider initialMessages={messages} key={resetKey}>
			<AgentChatContent
				chatId={chatId}
				className={className}
				historyLoaded={Boolean(
					chatId && !isUnpersistedSession && queriedMessages !== undefined
				)}
				historyMessages={messages}
				isNewChat={isNewChat}
				loadingMessages={loadingMessages}
				pendingMessage={pendingMessage}
				setSessionMessages={setSessionMessages}
				setPendingMessage={setPendingMessage}
				title={title}
			>
				{children}
			</AgentChatContent>
		</Provider>
	);
}

function AgentChatContent({
	children,
	className,
	chatId,
	historyLoaded,
	historyMessages,
	isNewChat,
	loadingMessages,
	pendingMessage,
	title,
	setSessionMessages,
	setPendingMessage,
}: {
	children?: ReactNode;
	className?: string;
	chatId?: string;
	historyLoaded: boolean;
	historyMessages: UIMessage[];
	isNewChat: boolean;
	loadingMessages: boolean;
	pendingMessage: { text: string; attachments: Array<{ url: string; filename: string; mediaType: string }> } | null;
	title: string;
	setSessionMessages: (messages: UIMessage[]) => void;
	setPendingMessage: (message: { text: string; attachments: Array<{ url: string; filename: string; mediaType: string }> } | null) => void;
}) {
	const { getToken, isLoaded: clerkLoaded, isSignedIn } = useAuth();
	const { isMobile, open, openMobile } = useSidebar();
	const showSidebarTrigger = isMobile ? !openMobile : !open;
	const navigate = useNavigate();
	const setSessionId = useChatSession((state) => state.setSessionId);
	const sessionIdRef = useRef<string | null>(chatId ?? null);
	const pendingHandledRef = useRef(false);
	const hydratedChatIdRef = useRef<string | null>(null);
	const [streamedChatTitle] = useDataPart<{ title: string }>("chat-title");
	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/chat",
				prepareSendMessagesRequest: async ({ id, messages, trigger }) => {
					const token = await getToken();
					const message = messages.at(-1);
					if (!message) {
						throw new Error("Cannot send an empty chat");
					}
					const headers: Record<string, string> = {};
					if (token) {
						headers.Authorization = `Bearer ${token}`;
					}
					const requestChatId = sessionIdRef.current ?? chatId ?? id;
					return {
						body: {
							id: requestChatId,
							message,
							trigger,
						},
						headers,
					};
				},
			}),
		[getToken, chatId]
	);
	const {
		messages: chatMessages,
		sendMessage,
		setMessages: setChatMessages,
	} = useChat({
		id: chatId,
		transport,
		dataPartSchemas: chatDataPartSchemas,
		experimental_throttle: 50,
		sendAutomaticallyWhen: shouldContinueAfterToolResult,
	});
	useEffect(() => {
		if (
			!chatId ||
			!historyLoaded ||
			hydratedChatIdRef.current === chatId
		)
			return;
		hydratedChatIdRef.current = chatId;
		setChatMessages(historyMessages);
	}, [chatId, historyLoaded, historyMessages, setChatMessages]);
	useEffect(
		() => setSessionMessages(chatMessages),
		[chatMessages, setSessionMessages]
	);
	useEffect(() => {
		if (
			!pendingMessage ||
			isNewChat ||
			!clerkLoaded ||
			!isSignedIn ||
			pendingHandledRef.current
		)
			return;
		pendingHandledRef.current = true;
		void sendMessage({
			role: "user",
			parts: [
				...(pendingMessage.text ? [{ type: "text" as const, text: pendingMessage.text }] : []),
				...pendingMessage.attachments.map((attachment) => ({ type: "file" as const, mediaType: attachment.mediaType, filename: attachment.filename, url: attachment.url })),
			],
			metadata: { createdAt: new Date().toISOString() },
		}).then(
			() => setPendingMessage(null),
			() => setPendingMessage(null)
		);
	}, [
		clerkLoaded,
		isNewChat,
		isSignedIn,
		pendingMessage,
		sendMessage,
		setPendingMessage,
	]);
	const handleNewChatSubmit = (text: string, attachments: Array<{ url: string; filename: string; mediaType: string }> = []) => {
		if (!isNewChat) return;
		const chatId = sessionIdRef.current ?? crypto.randomUUID();
		sessionIdRef.current = chatId;
		setSessionId(chatId);
		setPendingMessage({ text, attachments });
		void navigate({
			to: "/c/$chatId",
			params: { chatId },
			replace: true,
		});
	};
	const showNewChat = isNewChat && chatMessages.length === 0;
	const waitingForInitialMessages = loadingMessages && chatMessages.length === 0;
	const currentTitle = streamedChatTitle?.title ?? title;

	return (
		<section className={cn("relative flex min-h-0 w-full flex-1 flex-col", className)}>
			{children}
			{showNewChat ? null : (
				<AgentHeader className="sticky top-0 z-10 justify-center bg-background text-sm">
					{showSidebarTrigger && <SidebarTrigger className="absolute top-1/2 left-3 -translate-y-1/2" />}
					{currentTitle}
				</AgentHeader>
			)}
			<AnimatePresence mode="wait">
				{showNewChat ? (
					<motion.div
						key="empty-state"
						className="flex min-h-0 flex-1 flex-col"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: 0.24, ease: "easeOut" }}
					>
						<EmptyState onSubmit={handleNewChatSubmit} />
					</motion.div>
				) : (
					<motion.div
						key="messages"
						className="flex min-h-0 flex-1 flex-col"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: 0.2, ease: "easeOut" }}
					>
						<MessageScrollerProvider
							autoScroll
							defaultScrollPosition="last-anchor"
						>
							<AgentChatMessages>
								{waitingForInitialMessages ? (
									<div className="flex min-h-48 flex-1 items-center justify-center">
										<Spinner />
									</div>
								) : (
									<AgentMessageList messages={chatMessages} sessionId={sessionIdRef.current ?? chatId ?? ""} />
								)}
							</AgentChatMessages>
						</MessageScrollerProvider>
					</motion.div>
				)}
			</AnimatePresence>
			<div className="shrink-0 px-4 pb-4">
				<AgentChatInput
					disabled={waitingForInitialMessages}
					layout="adaptive"
					onSubmit={isNewChat ? handleNewChatSubmit : undefined}
				/>
			</div>
		</section>
	);
}

/** Scrollable message area for use inside AgentChat. */
export function AgentChatMessages({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<MessageScroller className={cn("min-h-0 flex-1", className)}>
			<MessageScrollerViewport>
				<MessageScrollerContent className="gap-2 pt-4 pb-16">
					{children}
				</MessageScrollerContent>
			</MessageScrollerViewport>
			<MessageScrollerButton />
		</MessageScroller>
	);
}
