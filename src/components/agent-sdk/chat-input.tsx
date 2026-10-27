import { useChatActions, useChatMessages, useChatStatus } from "@ai-sdk-tools/store";
import type { UIMessage } from "ai";
import { useUpload } from "@upstash/blob/react";
import { AnimatePresence, Reorder } from "motion/react";
import { ArrowUpIcon, CheckIcon, MicIcon, PlusIcon, SquareIcon, XIcon } from "lucide-react";
import { useAuth } from "@clerk/tanstack-react-start";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { Spinner } from "#/components/spinner";
import { Button } from "#/components/ui/button";
import {
	Composer,
	ComposerActionGroup,
	ComposerActions,
	ComposerInput,
	ComposerSubmit,
	type ComposerValue,
	getComposerText,
} from "#/components/ui/composer";
import { cn } from "#/lib/utils";
import { toast } from "#/lib/toast";

type SentAttachment = { url: string; filename: string; mediaType: string };
type ComposerAttachment = SentAttachment & {
	id: string;
	path?: string;
	file: File;
	previewUrl: string;
	status: "uploading" | "done" | "error" | "canceled";
	percent: number;
	error?: string;
};

const WAVE_BAR_WIDTH = 4;
const WAVE_GAP = 2;
const WAVE_STEP = WAVE_BAR_WIDTH + WAVE_GAP;
const WAVE_SAMPLE_MS = 60;

function VoiceWaveform({ analyser }: { analyser: AnalyserNode }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;
		const samples = new Uint8Array(analyser.fftSize);
		const levels: number[] = [];
		let width = 0;
		let height = 0;
		let frame = 0;
		let previousTime = 0;
		let sampleElapsed = 0;
		let scrollPhase = 0;
		let level = 0;
		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			width = canvas.clientWidth;
			height = canvas.clientHeight;
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		const draw = (time: number) => {
			frame = requestAnimationFrame(draw);
			const elapsed = previousTime ? Math.min(time - previousTime, WAVE_SAMPLE_MS * 4) : 0;
			previousTime = time;
			sampleElapsed += elapsed;
			scrollPhase = (scrollPhase + (WAVE_STEP * elapsed) / WAVE_SAMPLE_MS) % WAVE_STEP;
			while (sampleElapsed >= WAVE_SAMPLE_MS) {
				sampleElapsed -= WAVE_SAMPLE_MS;
				analyser.getByteTimeDomainData(samples);
				let sum = 0;
				for (const sample of samples) {
					const normalized = (sample - 128) / 128;
					sum += normalized * normalized;
				}
				const amplitude = Math.min(1, Math.sqrt(sum / samples.length) * 4);
				level += (amplitude - level) * (amplitude > level ? 0.72 : 0.28);
				levels.push(level);
				if (levels.length > 2000) levels.splice(0, levels.length - 1000);
			}
			context.clearRect(0, 0, width, height);
			context.fillStyle = getComputedStyle(canvas).color;
			const slots = Math.ceil(width / WAVE_STEP) + 1;
			const middle = height / 2;
			for (let index = 0; index < slots; index++) {
				const x = width - (index + 1) * WAVE_STEP - scrollPhase;
				const sampleIndex = levels.length - 1 - index;
				if (x > width || x + WAVE_BAR_WIDTH < 0) continue;
				const barHeight = sampleIndex < 0 ? 2 : Math.max(3, levels[sampleIndex] * height * 0.9);
				context.beginPath();
				context.roundRect(x, middle - barHeight / 2, WAVE_BAR_WIDTH, barHeight, WAVE_BAR_WIDTH / 2);
				context.fill();
			}
		};
		frame = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [analyser]);

	return <canvas aria-label="Audio level waveform" className="block h-9 min-w-0 flex-1 text-muted-foreground" ref={canvasRef} />;
}

function formatBytes(bytes: number) {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AgentChatInput({
	onSubmit,
	onStop,
	disabled = false,
	isStreaming,
	isSubmitting,
	placeholder = "Lets fix this problem...",
	className,
	layout = "adaptive",
}: {
	onSubmit?: (value: string, attachments: SentAttachment[]) => void | Promise<void>;
	onStop?: () => void;
	disabled?: boolean;
	isStreaming?: boolean;
	isSubmitting?: boolean;
	placeholder?: string;
	className?: string;
	layout?: "stacked" | "adaptive";
}) {
	const [value, setValue] = useState<ComposerValue>([]);
	const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
	const [dragging, setDragging] = useState(false);
	const [uploadNotice, setUploadNotice] = useState("");
	const [listening, setListening] = useState(false);
	const [connecting, setConnecting] = useState(false);
	const [dictationText, setDictationText] = useState("");
	const [interim, setInterim] = useState("");
	const [waveformAnalyser, setWaveformAnalyser] = useState<AnalyserNode | null>(null);
	const dragDepth = useRef(0);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const inputRef = useRef<HTMLDivElement>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const recorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const dictationStartValueRef = useRef<ComposerValue>([]);
	const dictationTextRef = useRef("");
	const interimRef = useRef("");
	const { getToken } = useAuth();
	const { start, uploads, clear, accept } = useUpload("", {
		endpoint: "/api/upload",
		headers: async () => {
			const token = await getToken();
			if (!token) throw new Error("Sign in to upload images");
			return { authorization: `Bearer ${token}` };
		},
		concurrency: 3,
	});
	const status = useChatStatus();
	const messages = useChatMessages<UIMessage>();
	const { sendMessage, stop, setMessages } = useChatActions<UIMessage>();
	const streaming = isStreaming ?? status === "streaming";
	const submitting = isSubmitting ?? status === "submitted";
	const text = getComposerText(value).trim();
	const hasPendingUploads = attachments.some((attachment) => attachment.status === "uploading");
	const completedAttachments = attachments.filter((attachment) => attachment.status === "done");
	const submitDisabled = disabled || submitting || streaming || hasPendingUploads || (!text && completedAttachments.length === 0);
	const stopDictation = useCallback(() => {
		setConnecting(false);
		const recorder = recorderRef.current;
		recorderRef.current = null;
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
		if (audioContextRef.current && audioContextRef.current.state !== "closed") void audioContextRef.current.close();
		audioContextRef.current = null;
		setWaveformAnalyser(null);
		const socket = wsRef.current;
		wsRef.current = null;
		const closeSocket = () => {
			if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "CloseStream" }));
			if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
		};
		if (recorder && recorder.state !== "inactive") {
			recorder.onstop = closeSocket;
			recorder.stop();
		} else closeSocket();
		setListening(false);
	}, []);
	const startDictation = useCallback(async () => {
		if (connecting || listening) return;
		setConnecting(true);
		setDictationText("");
		setInterim("");
		dictationTextRef.current = "";
		interimRef.current = "";
		try {
			dictationStartValueRef.current = value;
			const response = await fetch("/api/dg-token", { method: "POST" });
			if (!response.ok) throw new Error("Could not get a Deepgram token");
			const { token } = await response.json() as { token: string };
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			const audioContext = new AudioContext();
			const source = audioContext.createMediaStreamSource(stream);
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = 1024;
			source.connect(analyser);
			audioContextRef.current = audioContext;
			setWaveformAnalyser(analyser);
			const mimeType = ["audio/webm;codecs=opus", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
			if (!mimeType) throw new Error("This browser does not support audio recording");
			const query = new URLSearchParams({ model: "nova-3", interim_results: "true", smart_format: "true", endpointing: "300", ...(mimeType.includes("webm") ? { encoding: "opus" } : { encoding: "aac" }) });
			const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${query}`, ["bearer", token]);
			wsRef.current = socket;
			socket.onopen = () => {
				const recorder = new MediaRecorder(stream, { mimeType });
				recorderRef.current = recorder;
				recorder.ondataavailable = (event) => { if (event.data.size && socket.readyState === WebSocket.OPEN) socket.send(event.data); };
				recorder.start(250);
				setConnecting(false);
				setListening(true);
			};
			socket.onmessage = (event) => {
				const data = JSON.parse(event.data) as { channel?: { alternatives?: Array<{ transcript?: string }> }; is_final?: boolean };
				const transcript = data.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
				if (!transcript) return;
				if (data.is_final) {
					dictationTextRef.current = `${dictationTextRef.current}${dictationTextRef.current ? " " : ""}${transcript}`;
					setDictationText(dictationTextRef.current);
					interimRef.current = "";
					setInterim("");
				} else {
					interimRef.current = transcript;
					setInterim(transcript);
				}
			};
			socket.onerror = () => {
				stopDictation();
				toast.error("Something went wrong connecting to the microphone");
			};
			socket.onclose = () => {
				if (wsRef.current === socket) {
					stopDictation();
					toast.error("Something went wrong connecting to the microphone");
				}
			};
		} catch {
			stopDictation();
			toast.error("Something went wrong connecting to the microphone");
		}
	}, [connecting, listening, setValue, stopDictation, value]);
	const finishDictation = useCallback(() => {
		const transcript = [dictationTextRef.current, interimRef.current].filter(Boolean).join(" ").trim();
		stopDictation();
		if (transcript) {
			setValue((current) => [...current, { type: "text", text: `${getComposerText(current) ? " " : ""}${transcript}` }]);
		}
		dictationTextRef.current = "";
		interimRef.current = "";
		setDictationText("");
		setInterim("");
	}, [setValue, stopDictation]);
	const cancelDictation = useCallback(() => {
		stopDictation();
		setValue(dictationStartValueRef.current);
		dictationTextRef.current = "";
		interimRef.current = "";
		setDictationText("");
		setInterim("");
	}, [setValue, stopDictation]);
	useEffect(() => () => stopDictation(), [stopDictation]);
	useLayoutEffect(() => {
		inputRef.current?.focus();
	}, []);

	useEffect(() => {
		setAttachments((current) => {
			let changed = false;
			const next = current.map((attachment) => {
				const upload = uploads.find((record) => record.id === attachment.id);
				if (!upload) return attachment;
				const status = upload.status === "done" ? (upload.blob.url ? "done" : "error") : upload.status === "error" ? "error" : upload.status === "canceled" ? "canceled" : "uploading";
				const data = upload.status === "done" ? upload.blob.data as { path?: string; filename?: string; contentType?: string } : undefined;
				const updated = { ...attachment, status, percent: upload.percent, ...(upload.status === "done" ? { url: upload.blob.url ?? "", path: data?.path ?? upload.blob.path, filename: data?.filename ?? attachment.filename, mediaType: data?.contentType ?? attachment.mediaType, ...(upload.blob.url ? {} : { error: "Image uploads need a public Upstash Blob bucket." }) } : {}), ...(upload.status === "error" ? { error: upload.error.message } : {}) } as ComposerAttachment;
				if (updated.status !== attachment.status || updated.percent !== attachment.percent || updated.url !== attachment.url || updated.error !== attachment.error) changed = true;
				return updated;
			});
			return changed ? next : current;
		});
	}, [uploads]);

	const addFiles = useCallback((files: FileList | File[]) => {
		for (const file of Array.from(files)) {
			if (!file.type.startsWith("image/")) { setUploadNotice(`${file.name} is not an image.`); continue; }
			if (file.size > 5_000_000) { setUploadNotice(`${file.name} is larger than 5 MB.`); continue; }
			setUploadNotice("");
			const upload = start({ file });
			if (!upload) continue;
			setAttachments((current) => [...current, {
				id: upload.id, file, filename: file.name, mediaType: file.type, url: "", previewUrl: URL.createObjectURL(file), status: "uploading", percent: 0,
			}]);
		}
	}, [start]);

	const removeAttachment = useCallback((attachment: ComposerAttachment) => {
		const upload = uploads.find((record) => record.id === attachment.id);
		if (upload?.pending) upload.cancel();
		clear(attachment.id);
		setAttachments((current) => current.filter((item) => item.id !== attachment.id));
		URL.revokeObjectURL(attachment.previewUrl);
		if (attachment.path) {
			void getToken().then((token) => fetch("/api/upload/delete", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ path: attachment.path }) }));
		}
	}, [clear, getToken, uploads]);

	const handleSubmit = useCallback(
		(draft: ComposerValue) => {
			const message = getComposerText(draft).trim();
			const sentAttachments = attachments.filter((attachment) => attachment.status === "done").map(({ url, filename, mediaType }) => ({ url, filename, mediaType }));
			if ((!message && sentAttachments.length === 0) || disabled || submitting || streaming || hasPendingUploads) {
				return;
			}
			if (onSubmit) {
				void onSubmit(message, sentAttachments);
			} else {
				setMessages(messages.map((chatMessage) => ({
					...chatMessage,
					parts: chatMessage.parts.map((rawPart) => {
						const part = rawPart as { type: string; state?: string; toolCallId?: string; [key: string]: unknown };
						if (part.state !== "input-available") return rawPart;
						if (part.type === "tool-askUserQuestionnaire") return { ...part, state: "output-available", output: { status: "skipped", reason: "user_sent_new_message" } } as typeof rawPart;
						if (part.type === "tool-guide_steps") return { ...part, state: "output-available", output: { results: [], stoppedReason: "interrupted" } } as typeof rawPart;
						return rawPart;
					}),
				})));
				void sendMessage({
					role: "user",
					parts: [
						...(message ? [{ type: "text" as const, text: message }] : []),
						...attachments.filter((attachment) => attachment.status === "done").map((attachment) => ({ type: "file" as const, mediaType: attachment.mediaType, filename: attachment.filename, url: attachment.url })),
					],
					metadata: { createdAt: new Date().toISOString() },
				});
			}
			setValue([]);
			for (const attachment of attachments) URL.revokeObjectURL(attachment.previewUrl);
			setAttachments([]);
		},
		[attachments, disabled, hasPendingUploads, messages, onSubmit, sendMessage, setMessages, streaming, submitting]
	);

	const onDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		dragDepth.current = 0;
		setDragging(false);
		if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
	};

	return (
		<div className="relative z-10 mx-auto w-full max-w-[45rem]" onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); dragDepth.current += 1; setDragging(true); } }} onDragLeave={() => { dragDepth.current -= 1; if (dragDepth.current <= 0) setDragging(false); }} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDrop={onDrop}>
			<AnimatePresence>
				{dragging ? <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/95 text-sm font-medium text-primary" key="drop-overlay">Drop images here</div> : null}
			</AnimatePresence>
			<input accept={accept || "image/*"} className="hidden" multiple onChange={(event) => { if (event.currentTarget.files) addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} ref={fileInputRef} type="file" />
			<Composer
				className={cn("border-muted-foreground/30 bg-background/95", className)}
				layout={attachments.length > 0 || listening ? "stacked" : layout}
				onSubmit={handleSubmit}
				onValueChange={setValue}
				submitDisabled={submitDisabled}
				value={value}
			>
				{attachments.length > 0 ? (
					<Reorder.Group axis="x" as="div" values={attachments} onReorder={setAttachments} className="flex gap-2 overflow-x-auto px-2 pt-2">
						{attachments.map((attachment) => <Reorder.Item key={attachment.id} value={attachment} className="w-52 shrink-0 cursor-grab active:cursor-grabbing">
							<div className="flex items-center gap-2 rounded-xl border bg-muted/60 p-1.5">
							<div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
								<img alt="" className="size-full object-cover" src={attachment.previewUrl} />
								{attachment.status === "uploading" ? <div className="absolute inset-0 grid place-items-center bg-black/40"><svg aria-label={`Uploading ${Math.round(attachment.percent)} percent`} className="size-7 -rotate-90" role="img" viewBox="0 0 36 36"><circle className="stroke-white/35" cx="18" cy="18" fill="none" r="15" strokeWidth="3" /><circle className="stroke-white" cx="18" cy="18" fill="none" r="15" strokeDasharray={`${attachment.percent * 0.942} 100`} strokeLinecap="round" strokeWidth="3" /></svg></div> : null}
								{attachment.status === "error" ? <div className="absolute inset-0 flex items-center justify-center bg-destructive/70 px-1 text-center text-[8px] leading-tight text-white" title={attachment.error}>{attachment.error ?? "Upload failed"}</div> : null}
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate text-xs font-medium" title={attachment.filename}>{attachment.filename}</div>
								<div className="text-[10px] text-muted-foreground">{formatBytes(attachment.file.size)}</div>
							</div>
							<button aria-label={`Remove ${attachment.filename}`} className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => removeAttachment(attachment)} type="button"><XIcon className="size-3.5" /></button>
							</div>
						</Reorder.Item>)}
					</Reorder.Group>
				) : null}
				{uploadNotice ? <p aria-live="polite" className="px-3 pt-1 text-xs text-destructive">{uploadNotice}</p> : null}
				<div className="relative">
					{dictationText || interim ? <div aria-hidden="true" className="pointer-events-none absolute inset-0 whitespace-pre-wrap wrap-anywhere px-[calc(--spacing(3)-1px)] py-1 text-base text-muted-foreground/65 md:text-sm"><span className="invisible">{getComposerText(value)}{getComposerText(value) ? " " : ""}</span>{[dictationText, interim].filter(Boolean).join(" ")}</div> : null}
					<ComposerInput aria-label={placeholder} className={dictationText || interim ? "text-transparent caret-foreground" : ""} placeholder={listening ? (dictationText || interim ? "" : "Listening...") : placeholder} ref={inputRef} />
				</div>
				<ComposerActions>
					{listening ? (
						<div aria-label="Voice recorder" className="flex w-full min-w-0 items-center gap-3 px-1" role="group">
							{waveformAnalyser ? <VoiceWaveform analyser={waveformAnalyser} /> : <span className="h-9 min-w-0 flex-1" />}
							<Button aria-label="Cancel recording" className="size-8 shrink-0 rounded-lg" onClick={cancelDictation} size="icon" type="button" variant="secondary"><XIcon className="size-4" /></Button>
							<Button aria-label="Finish dictation" className="size-8 shrink-0 rounded-lg" onClick={finishDictation} size="icon" type="button"><CheckIcon className="size-4" /></Button>
						</div>
					) : (
						<>
							<ComposerActionGroup align="start">
								<Button aria-label="Add images" onClick={() => fileInputRef.current?.click()} size="icon" type="button" variant="ghost"><PlusIcon className="size-4" /></Button>
							</ComposerActionGroup>
							<ComposerActionGroup align="end">
								{streaming ? (
									<Button aria-label="Stop generating" disabled={!(onStop || stop)} onClick={() => (onStop ?? stop)()} size="icon" type="button"><SquareIcon className="size-4 fill-current" /></Button>
								) : submitting ? (
									<Button aria-label="Sending message" disabled size="icon" type="button"><Spinner color="white" size={16} /></Button>
								) : connecting ? (
									<Button aria-label="Connecting to microphone" disabled size="icon" type="button"><Spinner color="white" size={16} /></Button>
								) : text ? (
									<ComposerSubmit disabled={submitDisabled} render={<Button aria-label="Send message" size="icon"><ArrowUpIcon className="size-4" /></Button>} />
								) : (
									<Button aria-label="Start voice dictation" onClick={() => void startDictation()} size="icon" type="button"><MicIcon className="size-4" /></Button>
								)}
							</ComposerActionGroup>
						</>
					)}
				</ComposerActions>
			</Composer>
		</div>
	);
}

export const ChatInput = AgentChatInput;
