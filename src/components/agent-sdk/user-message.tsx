import type { UIMessage } from "ai";
import { useChatActions } from "@ai-sdk-tools/store";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ImageIcon } from "lucide-react";
import { cn } from "#/lib/utils";
import { ChatMessage } from "#/components/chat/chat-message";
import { Button } from "#/components/ui/button";
import { Carousel, CarouselItem, CarouselNext, CarouselPrevious, useCarouselNavigation } from "#/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Textarea } from "#/components/ui/textarea";
import { QuestionnaireAnswersCard } from "./questionnaire-card";
import { UserMessageActions } from "./user-message-actions";
import type { ToolOutput } from "#/lib/questionnaire/schema";

export function getMessageText(message: UIMessage) {
	return message.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("");
}

export function UserMessage({
	message,
	createdAt,
	disabled = false,
	animateEntry = false,
	questionnaireCollapsed,
	onToggleQuestionnaire,
}: {
	message: UIMessage;
	createdAt?: Date;
	disabled?: boolean;
	animateEntry?: boolean;
	/** Undefined: not in a foldable round, always show the full card.
	 * Otherwise controlled by the parent round state. */
	questionnaireCollapsed?: boolean;
	onToggleQuestionnaire?: (expanded: boolean) => void;
}) {
	const text = getMessageText(message);
	const messageMetadata = message.metadata as {
		questionnaireTurn?: { status?: string; title?: string; answers?: Extract<ToolOutput, { status: "submitted" }>['answers'] };
	} | undefined;
	const questionnaireAnswers = messageMetadata?.questionnaireTurn?.status === "submitted"
		? messageMetadata.questionnaireTurn
		: undefined;
	const images = message.parts.flatMap((part) => {
		if (part.type !== "file" || !part.mediaType.startsWith("image/")) return [];
		const url = "url" in part ? String(part.url) : "";
		return url ? [{ url, filename: "filename" in part && typeof part.filename === "string" ? part.filename : "Image" }] : [];
	});
	const { sendMessage } = useChatActions();
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(text);
	const [galleryOpen, setGalleryOpen] = useState(false);
	const [carouselApi, setCarouselApi] = useState<import("embla-carousel").EmblaCarouselType | null>(null);
	const { canScrollPrevious, canScrollNext, previous, next } = useCarouselNavigation(carouselApi);
	const editorRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (isEditing) editorRef.current?.focus();
	}, [isEditing]);

	const cancelEditing = () => {
		setDraft(text);
		setIsEditing(false);
	};

	let questionnaireNode: ReactNode = null;
	if (questionnaireAnswers?.answers) {
		if (questionnaireCollapsed === undefined) {
			questionnaireNode = <QuestionnaireAnswersCard answers={questionnaireAnswers.answers} title={questionnaireAnswers.title} />;
		} else {
			questionnaireNode = (
				<div className="flex w-full flex-col items-end gap-1.5">
					<button
						aria-expanded={!questionnaireCollapsed}
						className="flex min-h-7 cursor-pointer items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
						onClick={() => onToggleQuestionnaire?.(Boolean(questionnaireCollapsed))}
						type="button"
					>
						<span>{`Questions answered · ${questionnaireAnswers.answers.length} ${questionnaireAnswers.answers.length === 1 ? "detail" : "details"}`}</span>
						<ChevronDown aria-hidden="true" className={cn("size-3.5 shrink-0 transition-transform duration-[260ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]", !questionnaireCollapsed && "rotate-180")} />
					</button>
					{/* Same opening motion as the research activity detail:
					    content stays mounted in a grid row that animates
					    between 0fr and 1fr on the material-standard curve,
					    clipped while closing. */}
					<div
						aria-hidden={questionnaireCollapsed}
						inert={questionnaireCollapsed}
						className={cn(
							"grid w-full transition-[grid-template-rows] duration-[260ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]",
							questionnaireCollapsed ? "[grid-template-rows:0fr]" : "[grid-template-rows:1fr]"
						)}
					>
						<div className="overflow-hidden">
							<div className="pt-1.5">
								<QuestionnaireAnswersCard answers={questionnaireAnswers.answers} title={questionnaireAnswers.title} />
							</div>
						</div>
					</div>
				</div>
			);
		}
	}

	const saveEdit = async () => {
		const updatedText = draft.trim();
		if (!updatedText || disabled) return;

		setIsEditing(false);
		try {
			await sendMessage({
				text: updatedText,
				messageId: message.id,
				metadata: createdAt
					? { createdAt: createdAt.toISOString() }
					: undefined,
			});
		} catch {
			setIsEditing(true);
		}
	};

	return (
		<div className="group flex w-full flex-col items-end gap-1.5">
			{isEditing ? (
				<div className="ml-auto flex w-full max-w-[min(100%,36rem)] flex-col gap-2 p-1">
						<Textarea
							aria-label="Edit message"
							autoFocus
							className="min-h-20 resize-y rounded-lg border-border bg-background px-3 py-2 text-sm shadow-xs"
							disabled={disabled}
							onChange={(event) => setDraft(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Escape") cancelEditing();
								if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
									event.preventDefault();
									void saveEdit();
								}
							}}
							ref={editorRef}
							value={draft}
						/>
						<div className="flex items-center justify-end gap-2">
							<Button
								disabled={disabled}
								onClick={cancelEditing}
								size="xs"
								variant="ghost"
							>
								Cancel
							</Button>
							<Button
								disabled={disabled || !draft.trim()}
								onClick={() => void saveEdit()}
								size="xs"
							>
								Save
							</Button>
						</div>
				</div>
			) : (
				<motion.div
					animate={{ opacity: 1, y: 0, scale: 1 }}
					className="flex w-full flex-col items-end gap-1.5"
					initial={animateEntry ? { opacity: 0, y: 3, scale: 0.98 } : undefined}
					transition={{ duration: 0.16, ease: "easeOut" }}
				>
					{questionnaireAnswers?.answers ? questionnaireNode : <>
					{images.length > 0 ? <button aria-label={`View ${images.length} attached image${images.length === 1 ? "" : "s"}`} className="group relative mb-1 block overflow-hidden rounded-xl border bg-muted text-left" onClick={() => setGalleryOpen(true)} type="button">
						<img alt={images.length === 1 ? images[0]?.filename : `${images[0]?.filename} and ${images.length - 1} more`} className="max-h-40 max-w-[min(12rem,60vw)] object-cover" src={images[0]?.url} />
						{images.length > 1 ? <span className="absolute inset-0 grid place-items-center bg-black/45 text-lg font-semibold text-white transition-colors group-hover:bg-black/55">+{images.length - 1}</span> : null}
					</button> : null}
					{text ? <ChatMessage role="user" text={text} /> : null}
					{text ? (
						<UserMessageActions
							createdAt={createdAt}
							disabled={disabled}
							onEdit={() => {
								setDraft(text);
								setIsEditing(true);
							}}
							text={text}
						/>
					) : null}
					</>}
					<Dialog onOpenChange={setGalleryOpen} open={galleryOpen}>
						<DialogContent className="max-w-3xl">
							<DialogHeader><DialogTitle className="flex items-center gap-2"><ImageIcon className="size-4" />Images</DialogTitle><DialogDescription>{images.length} attached image{images.length === 1 ? "" : "s"}</DialogDescription></DialogHeader>
							<Carousel className="mx-auto w-full max-w-2xl" setApi={setCarouselApi}>
								{images.map((image, index) => <CarouselItem key={`${image.url}-${index}`}><img alt={image.filename} className="mx-auto max-h-[65dvh] w-full rounded-lg object-contain" src={image.url} /></CarouselItem>)}
							</Carousel>
							{images.length > 1 ? <div className="mt-3 flex items-center justify-between"><CarouselPrevious disabled={!canScrollPrevious} onClick={previous} className="static translate-y-0" /><span className="text-xs text-muted-foreground">Use arrows or swipe to browse</span><CarouselNext disabled={!canScrollNext} onClick={next} className="static translate-y-0" /></div> : null}
						</DialogContent>
					</Dialog>
				</motion.div>
			)}
		</div>
	);
}
