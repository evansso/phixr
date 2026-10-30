import {
	memo,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ChevronDown } from "lucide-react";
import { marked } from "marked";
import ReactMarkdown, { type Options } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "#/lib/utils";
import "./chat-message.css";
import { useStreamingText } from "./use-streaming-text";

const COLLAPSED_USER_MESSAGE_HEIGHT = 200;

const LOG_LINE_PATTERNS = [
	/^\s*(\$|#|>>>)/,
	/^\s*\[?(sudo|dpkg|apt|apt-get|npm|pnpm|yarn|bun|error|warning|warn|info|debug)\b/i,
	/[\w.-]+@[\w.-]+[:~]/,
	/\b(error|warning|depends on|not installed):/i,
	/^\s*\(?(reading|preparing|unpacking|selecting|setting up|processing)\b/i,
];

/** Pasted terminal output / logs read far better in mono than in prose type. */
function isLogLike(text: string) {
	const lines = text.split("\n").filter((line) => line.trim());
	if (lines.length < 3) return false;
	const hits = lines.filter((line) =>
		LOG_LINE_PATTERNS.some((pattern) => pattern.test(line))
	).length;
	return hits >= 2 || (lines.length >= 8 && hits >= 1);
}

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
	// Height animates only on user toggle, never on first measurement,
	// so history does not visibly collapse on mount.
	const [animateHeight, setAnimateHeight] = useState(false);

	useEffect(() => {
		if (isStreaming) setHasStreamed(true);
	}, [isStreaming]);

	useEffect(() => {
		onRevealComplete?.(!isStreaming);
	}, [isStreaming, onRevealComplete]);

	useEffect(() => {
		// A replaced/edited message starts collapsed again.
		setIsExpanded(false);
	}, [text]);

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
		const logLike = isLogLike(text);
		const collapsed = isExpandable && !isExpanded;
		return (
			<div className={cn("flex w-full justify-end", className)}>
				<div
					className={cn(
						"w-fit min-w-0 rounded-2xl rounded-br-md bg-muted-foreground/10 px-3.5 py-2.5 text-foreground shadow-xs ring-1 ring-foreground/5",
						logLike ? "max-w-[min(100%,40rem)]" : "max-w-[min(100%,36rem)]"
					)}
				>
					<div
						className={cn(
							"agent-user-message-content overflow-hidden",
							animateHeight &&
								"transition-[height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
							collapsed && "is-collapsed"
						)}
						style={
							isExpandable
								? {
										height: `${isExpanded ? contentHeight : COLLAPSED_USER_MESSAGE_HEIGHT}px`,
									}
								: undefined
						}
					>
						<div
							className={cn(
								"whitespace-pre-wrap [overflow-wrap:anywhere]",
								logLike
									? "font-mono text-[13px] leading-relaxed"
									: "text-sm leading-relaxed"
							)}
							ref={contentRef}
						>
							{text}
						</div>
					</div>
					{isExpandable ? (
						<div className="flex justify-end pt-2">
							<button
								aria-expanded={isExpanded}
								className="inline-flex items-center gap-1 rounded-full bg-background/70 py-1 pr-2 pl-2.5 text-xs font-medium text-foreground ring-1 ring-foreground/10 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"
								onClick={() => {
									setAnimateHeight(true);
									setIsExpanded((value) => !value);
								}}
								type="button"
							>
								{isExpanded ? "Show less" : "Show more"}
								<ChevronDown
									aria-hidden="true"
									className={cn(
										"size-3.5 transition-transform duration-300 motion-reduce:transition-none",
										isExpanded && "rotate-180"
									)}
								/>
							</button>
						</div>
					) : null}
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