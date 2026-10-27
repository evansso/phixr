import { useAuth } from "@clerk/tanstack-react-start";
import { AnimatePresence, motion } from "motion/react";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Spinner } from "#/components/ui/spinner";
import { Textarea } from "#/components/ui/textarea";
import { toast } from "#/lib/toast";
import type { AnswerInput, PersistedAnswerMessage, Question, Questionnaire, ToolOutput } from "#/lib/questionnaire/schema";

type Draft = { selected: string[]; otherOn: boolean; otherText: string; text: string; yes?: boolean };
const empty: Draft = { selected: [], otherOn: false, otherText: "", text: "" };

function isAnswered(q: Question, d: Draft) {
	switch (q.type) {
		case "single_choice": case "multi_choice": return d.selected.length > 0 || (d.otherOn && d.otherText.trim().length > 0);
		case "yes_no": return d.yes !== undefined || d.otherText.trim().length > 0;
		case "text": return d.text.trim().length > 0;
	}
}

function toAnswer(q: Question, d: Draft): AnswerInput {
	if (!isAnswered(q, d)) return { questionId: q.id, skipped: true };
	switch (q.type) {
		case "single_choice": case "multi_choice": return { questionId: q.id, skipped: false, selected: d.selected, otherText: d.otherOn ? d.otherText.trim() : undefined };
		case "yes_no": return { questionId: q.id, skipped: false, yes: d.yes, otherText: d.otherText.trim() || undefined };
		case "text": return { questionId: q.id, skipped: false, text: d.text.trim() };
	}
}

export function QuestionnaireCard({ sessionId, toolCallId, input, onDone }: { sessionId: string; toolCallId: string; input: Questionnaire; onDone: (output: ToolOutput, answerMessage: PersistedAnswerMessage) => Promise<void> | void }) {
	const { getToken } = useAuth();
	const [drafts, setDrafts] = useState<Record<string, Draft>>({});
	const [step, setStep] = useState(0);
	const [direction, setDirection] = useState(1);
	const [busy, setBusy] = useState(false);
	const get = (id: string) => drafts[id] ?? empty;
	const patch = (id: string, change: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? empty), ...change } }));
	const question = input.questions[step];
	const currentDraft = question ? get(question.id) : empty;
	const canContinue = question?.required === false || (question ? isAnswered(question, currentDraft) : false);
	const canSubmit = input.questions.every((item) => item.required === false || isAnswered(item, get(item.id)));
	const goTo = (next: number) => {
		setDirection(next > step ? 1 : -1);
		setStep(next);
	};
	const handleSwipe = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
		const swipedLeft = info.offset.x < -80 || info.velocity.x < -500;
		const swipedRight = info.offset.x > 80 || info.velocity.x > 500;
		if (swipedLeft && step < input.questions.length - 1 && canContinue && !busy) goTo(step + 1);
		if (swipedRight && step > 0 && !busy) goTo(step - 1);
	};

	async function persist(action: "submitted" | "skipped") {
		setBusy(true);
		try {
			const token = await getToken();
			const response = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
				body: JSON.stringify({ intent: "submit-questionnaire", sessionKey: sessionId, toolCallId, action, questionnaire: input, answers: action === "submitted" ? input.questions.map((item) => toAnswer(item, get(item.id))) : [] }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? "Failed to save");
			const { answerMessage, ...output } = result;
			await onDone(output as ToolOutput, answerMessage as PersistedAnswerMessage);
		} catch {
			toast.error("Couldn't save your answers", "Please try again.");
			setBusy(false);
		}
	}

	if (!question) return null;
	return (
		<motion.section
			aria-label={input.title ?? "Questionnaire"}
			className="max-h-[min(68vh,38rem)] overflow-y-auto rounded-2xl border bg-popover p-3 text-popover-foreground sm:p-3.5"
			layout
			transition={{ layout: { type: "spring", stiffness: 360, damping: 34 } }}
		>
			<div className="mb-3 flex items-start justify-between gap-4">
				<div className="min-w-0">
					{input.title && <h3 className="mb-1 text-xs font-medium text-muted-foreground">{input.title}</h3>}
					<p className="text-sm font-medium leading-relaxed">{question.prompt}{question.required === false && <span className="text-muted-foreground"> (optional)</span>}</p>
					{question.hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{question.hint}</p>}
				</div>
				<div className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground" aria-label={`Question ${step + 1} of ${input.questions.length}`}>{step + 1} of {input.questions.length}</div>
			</div>

			<AnimatePresence custom={direction} initial={false} mode="wait">
				<motion.div
					key={question.id}
					custom={direction}
					drag="x"
					dragConstraints={{ left: 0, right: 0 }}
					dragElastic={0.18}
					onDragEnd={handleSwipe}
					style={{ touchAction: "pan-y" }}
					initial={(slideDirection: number) => ({ opacity: 0, x: slideDirection > 0 ? 28 : -28 })}
					animate={{ opacity: 1, x: 0 }}
					exit={(slideDirection: number) => ({ opacity: 0, x: slideDirection > 0 ? -28 : 28 })}
					transition={{ duration: 0.2, ease: "easeOut" }}
				>
					<fieldset className="flex flex-col gap-2.5">
						<legend className="sr-only">{question.prompt}</legend>
						{(question.type === "single_choice" || question.type === "multi_choice") && <>
							{question.options.filter((option) => option.label.trim().toLowerCase() !== "other").map((option, optionIndex) => {
								const checked = currentDraft.selected.includes(option.id);
								return <label className={`flex cursor-pointer items-center gap-2.5 border-b px-2 py-2 text-sm transition-colors last:border-b-0 hover:bg-accent/40 ${checked ? "bg-accent/35" : ""}`} key={option.id}>
									<span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-md text-xs tabular-nums transition-colors ${checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{optionIndex + 1}</span>
									<span>{option.label}</span>
									{question.type === "multi_choice" ? <Checkbox className="ml-auto" checked={checked} onCheckedChange={(on) => patch(question.id, { selected: on ? [...currentDraft.selected, option.id] : currentDraft.selected.filter((id) => id !== option.id) })} /> : <input checked={checked} className="sr-only" name={`${toolCallId}-${question.id}`} onChange={() => patch(question.id, { selected: [option.id], otherOn: false })} type="radio" />}
								</label>;
							})}
							<div className={`flex items-center gap-2.5 rounded-lg border-b px-2 py-2 text-sm transition-colors hover:bg-accent/40 ${currentDraft.otherOn ? "bg-accent/35" : ""}`}>
								<div className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground" aria-hidden="true"><Pencil className="size-3.5" /></div>
								<input aria-label="Something else" className="min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0" maxLength={500} onChange={(event) => patch(question.id, { otherOn: Boolean(event.target.value.trim()), otherText: event.target.value, ...(question.type === "single_choice" ? { selected: [] } : {}) })} onKeyDown={(event) => {
									if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
									event.preventDefault();
									if (step < input.questions.length - 1 && canContinue && !busy) goTo(step + 1);
									else if (step === input.questions.length - 1 && canSubmit && !busy) void persist("submitted");
								}} placeholder="Something else" value={currentDraft.otherText} />
							</div>
						</>}
						{question.type === "yes_no" && <>
							{([true, false] as const).map((yes, optionIndex) => {
								const checked = currentDraft.yes === yes;
								return <label className={`flex cursor-pointer items-center gap-2.5 border-b px-2 py-2 text-sm transition-colors last:border-b-0 hover:bg-accent/40 ${checked ? "bg-accent/35" : ""}`} key={String(yes)}>
									<span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-md text-xs tabular-nums transition-colors ${checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{optionIndex + 1}</span>
									<span>{yes ? "Yes" : "No"}</span>
									<input checked={checked} className="sr-only" name={`${toolCallId}-${question.id}`} onChange={() => patch(question.id, { yes, otherText: "" })} type="radio" />
								</label>;
							})}
							<div className={`flex items-center gap-2.5 rounded-lg border-b px-2 py-2 text-sm transition-colors hover:bg-accent/40 ${currentDraft.yes === undefined && currentDraft.otherText.trim() ? "bg-accent/35" : ""}`}>
								<div className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground" aria-hidden="true"><Pencil className="size-3.5" /></div>
								<input aria-label="Something else" className="min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0" maxLength={500} onChange={(event) => patch(question.id, { yes: undefined, otherText: event.target.value })} onKeyDown={(event) => {
									if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
									event.preventDefault();
									if (step < input.questions.length - 1 && canContinue && !busy) goTo(step + 1);
									else if (step === input.questions.length - 1 && canSubmit && !busy) void persist("submitted");
								}} placeholder="Something else" value={currentDraft.otherText} />
							</div>
						</>}
						{question.type === "text" && <Textarea value={currentDraft.text} onChange={(event) => patch(question.id, { text: event.target.value })} placeholder={question.placeholder} maxLength={2000} />}
					</fieldset>
				</motion.div>
			</AnimatePresence>

			<div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
				<Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void persist("skipped")}>Skip</Button>
				<div className="flex gap-2">
					<Button type="button" size="sm" variant="ghost" disabled={step === 0 || busy} onClick={() => goTo(step - 1)}>Back</Button>
					{step < input.questions.length - 1 && <Button type="button" size="sm" disabled={!canContinue || busy} onClick={() => goTo(step + 1)}>Next</Button>}
					{step === input.questions.length - 1 && <Button type="button" size="sm" disabled={!canSubmit || busy} onClick={() => void persist("submitted")}>{busy ? <><Spinner className="size-3.5" />Saving…</> : "Submit"}</Button>}
				</div>
			</div>
		</motion.section>
	);
}

export function QuestionnaireAskedStatus({ status }: { status: "submitted" | "skipped" }) {
	return <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground/60" />{status === "submitted" ? "Questions were asked" : "Questions were skipped"}</p>;
}

export function QuestionnaireAnswersCard({ title, answers }: { title?: string; answers: Extract<ToolOutput, { status: "submitted" }>['answers'] }) {
	return <section aria-label="Your answers" className="w-full rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
		<div className="mb-3 flex items-baseline justify-between gap-3 border-b pb-2.5">
			<div className="min-w-0"><h3 className="text-sm font-medium">{title || "Your answers"}</h3>{title ? <p className="mt-0.5 text-xs text-muted-foreground">Your answers</p> : null}</div>
			<span className="shrink-0 text-xs tabular-nums text-muted-foreground">{answers.length} {answers.length === 1 ? "answer" : "answers"}</span>
		</div>
		<dl className="flex flex-col gap-3">
			{answers.map((answer) => <div className="grid gap-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-4" key={answer.questionId}>
				<dt className="text-xs leading-relaxed text-muted-foreground">{answer.prompt}</dt>
				<dd className="min-w-0 text-sm leading-relaxed">{answer.answer === null ? "Skipped" : typeof answer.answer === "boolean" ? answer.answer ? "Yes" : "No" : Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer}{answer.other ? `: ${answer.other}` : ""}</dd>
			</div>)}
		</dl>
	</section>;
}
