import { useLocation } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { createStore, useStore } from "zustand";

type ChatSessionState = {
	isNewChat: boolean;
	resetKey: number;
	sessionId: string | null;
	messages: UIMessage[];
	title: string;
	pendingMessage: { text: string; attachments: Array<{ url: string; filename: string; mediaType: string }> } | null;
	beginNewChat: () => void;
	enterExistingChat: (sessionId: string) => void;
	setSessionId: (sessionId: string) => void;
	setMessages: (messages: UIMessage[]) => void;
	setTitle: (title: string) => void;
	setPendingMessage: (message: ChatSessionState["pendingMessage"]) => void;
};

type ChatSessionStore = ReturnType<typeof createChatSessionStore>;
const ChatSessionContext = createContext<ChatSessionStore | null>(null);

function createChatSessionStore() {
	return createStore<ChatSessionState>((set) => ({
		isNewChat: false,
		resetKey: 0,
		sessionId: null,
		messages: [],
		title: "New chat",
		pendingMessage: null,
		beginNewChat: () =>
			set((state) => ({
				isNewChat: true,
				resetKey: state.resetKey + 1,
				sessionId: null,
				messages: [],
				title: "New chat",
				pendingMessage: null,
			})),
		enterExistingChat: (sessionId) =>
			set((state) =>
				state.sessionId === sessionId
					? state
					: {
							isNewChat: false,
							resetKey: state.resetKey + 1,
							sessionId,
							messages: [],
							title: "New chat",
							pendingMessage: null,
						}
			),
		setSessionId: (sessionId) => set({ sessionId, isNewChat: true }),
		setMessages: (messages) => set({ messages }),
		setTitle: (title) => set({ title }),
		setPendingMessage: (pendingMessage) => set({ pendingMessage }),
	}));
}

export function ChatSessionProvider({ children }: { children: ReactNode }) {
	const [store] = useState(createChatSessionStore);
	const pathname = useLocation({ select: (location) => location.pathname });

	useEffect(() => {
		if (pathname === "/new") {
			store.getState().beginNewChat();
			return;
		}
		const match = pathname.match(/^\/c\/([^/]+)$/);
		if (match) {
			store.getState().enterExistingChat(decodeURIComponent(match[1]));
		}
	}, [pathname, store]);

	return (
		<ChatSessionContext.Provider value={store}>
			{children}
		</ChatSessionContext.Provider>
	);
}

export function useChatSession<T>(selector: (state: ChatSessionState) => T): T {
	const store = useContext(ChatSessionContext);
	if (!store) {
		throw new Error("useChatSession must be used inside ChatSessionProvider");
	}
	return useStore(store, selector);
}
