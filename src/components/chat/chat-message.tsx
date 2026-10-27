import {
	type CSSProperties,
	memo,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { marked } from "marked";
import ReactMarkdown, { type Options } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "#/lib/utils";
import "./chat-message.css";
import { useStreamingText } from "./use-streaming-text";

const COLLAPSED_USER_MESSAGE_HEIGHT = 240;

type HastNode = {
	type: string;
	value?: string;
	tagName?: string;
	properties?: Record<string, unknown>;
	children?: HastNode[];
};

function rehypeWordSpans() {
	return (tree: HastNode) => {
		const wrapWords = (node: HastNode, insideCode = false): HastNode[] => {
			const isCode =
				insideCode || node.tagName === "code" || node.tagName === "pre";
			if (node.type === "text" && node.value && !isCode) {
				return node.value
					.split(/(\s+)/)
					.filter(Boolean)
					.map((part) =>
						/^\s+$/.test(part)
							? { type: "text", value: part }
							: {
									type: "element",
									tagName: "span",
									properties: { className: ["agent-word"] },
									children: [{ type: "text", value: part }],
								}
					);
			}
			if (node.children) {
				node.children = node.children.flatMap((child) =>
					wrapWords(child, isCode)
				);
			}
			return [node];
		};
		tree.children = tree.children?.flatMap((child) => wrapWords(child));
	};
}

// Module scope on purpose: stable references, nothing rebuilt per render.
const remarkPlugins: Options["remarkPlugins"] = [remarkGfm, remarkBreaks];
const rehypePlugins: Options["rehypePlugins"] = [rehypeWordSpans];

const splitBlocks = (markdown: string) =>
	marked.lexer(markdown).map((token) => token.raw);

/**
 * Finished blocks never change, so memo skips them entirely. Only the last,
 * still growing block is re-parsed per flush. Because React keeps the word
 * spans of old blocks mounted, their fade never replays.
 */
const MarkdownBlock = memo(function MarkdownBlock({
	content,
}: {
	content: string;
}) {
	return (
		<ReactMarkdown
			rehypePlugins={rehypePlugins}
			remarkPlugins={remarkPlugins}
		>
			{content}
		</ReactMarkdown>
	);
});

export type ChatMessageRole = "user" | "assistant";

export function ChatMessage({
	role,
	text,
	className,
	isStreaming = false,
	onRevealComplete,
}: {
	role: ChatMessageRole;
	text: string;
	className?: string;
	isStreaming?: boolean;
	onRevealComplete?: (complete: boolean) => void;
}) {
	const visibleText = useStreamingText(text, isStreaming);
	const blocks = useMemo(() => splitBlocks(visibleText), [visibleText]);
	// Historical messages mount with isStreaming false and never animate.
	const [hasStreamed, setHasStreamed] = useState(isStreaming);
	const contentRef = useRef<HTMLDivElement>(null);
	const [isExpandable, setIsExpandable] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const [contentHeight, setContentHeight] = useState(0);

	useEffect(() => {
		if (isStreaming) setHasStreamed(true);
	}, [isStreaming]);

	useEffect(() => {
		onRevealComplete?.(!isStreaming);
	}, [isStreaming, onRevealComplete]);

	useEffect(() => {
		if (role !== "user") return;
		const element = contentRef.current;
		if (!element) return;

		const updateOverflow = () => {
			setContentHeight(element.scrollHeight);
			setIsExpandable(element.scrollHeight > COLLAPSED_USER_MESSAGE_HEIGHT);
		};

		updateOverflow();
		const observer = new ResizeObserver(updateOverflow);
		observer.observe(element);
		return () => observer.disconnect();
	}, [role, text]);

	if (role === "user") {
		return (
			<div className={cn("flex w-full justify-end", className)}>
				<div className="relative w-fit max-w-[min(100%,36rem)] overflow-hidden rounded-lg bg-muted-foreground/10 px-2 py-1.5 text-foreground text-sm">
					<div
						className={cn(
							"agent-user-message-content",
							isExpanded && "is-expanded"
						)}
						style={
							{
								"--agent-message-height": `${contentHeight}px`,
							} as CSSProperties
						}
					>
						<div
							className="whitespace-pre-wrap break-words"
							ref={contentRef}
						>
							{text}
						</div>
					</div>
					{isExpandable && !isExpanded && (
						<div className="absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-muted-foreground/15 pb-2">
							<button
								className="text-xs font-medium text-foreground underline underline-offset-2"
								onClick={() => setIsExpanded(true)}
								type="button"
							>
								Show more
							</button>
						</div>
					)}
					{isExpandable && isExpanded && (
						<div className="flex justify-center bg-muted-foreground/15 px-3 pb-2">
							<button
								className="text-xs font-medium text-foreground underline underline-offset-2"
								onClick={() => setIsExpanded(false)}
								type="button"
							>
								Show less
							</button>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className={cn("w-full text-sm leading-relaxed", className)}>
			<div
				className={cn(
					"prose prose-sm max-w-none text-foreground",
					hasStreamed && "agent-streaming-content"
				)}
			>
				{blocks.map((block, index) => (
					<MarkdownBlock content={block} key={index} />
				))}
			</div>
		</div>
	);
}