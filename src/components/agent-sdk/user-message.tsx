import type { UIMessage } from "ai";
import { useChatActions } from "@ai-sdk-tools/store";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { ChatMessage } from "#/components/chat/chat-message";
import { Button } from "#/components/ui/button";
import { Carousel, CarouselItem, CarouselNext, CarouselPrevious, useCarouselNavigation } from "#/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Textarea } from "#/components/ui/textarea";
import { UserMessageActions } from "./user-message-actions";
import { QuestionnaireAnswersCard } from "./questionnaire-card";
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
}: {
	message: UIMessage;
	createdAt?: Date;
	disabled?: boolean;
	animateEntry?: boolean;
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

	const startEditing = () => {
		setDraft(text);
		setIsEditing(true);
	};

	const cancelEditing = () => {
		setDraft(text);
		setIsEditing(false);
	};

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
				<div className="flex w-full flex-col gap-2 p-1">
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
					{questionnaireAnswers?.answers ? <QuestionnaireAnswersCard answers={questionnaireAnswers.answers} title={questionnaireAnswers.title} /> : <>
					{images.length > 0 ? <button aria-label={`View ${images.length} attached image${images.length === 1 ? "" : "s"}`} className="group relative mb-1 block overflow-hidden rounded-xl border bg-muted text-left" onClick={() => setGalleryOpen(true)} type="button">
						<img alt={images.length === 1 ? images[0]?.filename : `${images[0]?.filename} and ${images.length - 1} more`} className="max-h-40 max-w-[min(12rem,60vw)] object-cover" src={images[0]?.url} />
						{images.length > 1 ? <span className="absolute inset-0 grid place-items-center bg-black/45 text-lg font-semibold text-white transition-colors group-hover:bg-black/55">+{images.length - 1}</span> : null}
					</button> : null}
					{text ? <ChatMessage role="user" text={text} /> : null}
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
					<UserMessageActions
						createdAt={createdAt}
						disabled={disabled}
						onEdit={questionnaireAnswers ? undefined : startEditing}
						text={text}
					/>
				</motion.div>
			)}
		</div>
	);
}
