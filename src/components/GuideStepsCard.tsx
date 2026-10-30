import { useAuth } from "@clerk/tanstack-react-start";
import { Check, ChevronDown, Circle, Copy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Spinner } from "#/components/ui/spinner";
import { Textarea } from "#/components/ui/textarea";
import { toast } from "#/lib/toast";
import { shouldReturnToModel, stoppedReasonFor } from "#/lib/guide-steps/advance";
import type { GuideStepsInput, GuideStepsOutput, Step, StepResult } from "#/lib/guide-steps/schema";

const outcomeOptions = [
	["matched_expected", "It matched"],
	["different_result", "It's different"],
	["error", "I got an error"],
	["could_not_run", "I couldn't run it"],
] as const;
const outcomeLabel: Record<string, string> = {
	matched_expected: "Matched", different_result: "Different", error: "Error",
	could_not_run: "Couldn't run", needs_help: "Needed help", interrupted: "Interrupted",
};
const kindLabel: Record<Step["kind"], string> = { diagnose: "Diagnose", fix: "Fix", verify: "Verify", manual: "Manual" };
const riskLabel: Record<string, string> = {
	read_only: "Read-only. Changes nothing.",
	changes_system: "Changes your system.",
	destructive: "Destructive. Back up first.",
};
const kindClass: Record<Step["kind"], string> = {
	diagnose: "bg-foreground/[0.08] text-muted-foreground",
	fix: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
	verify: "bg-green-500/15 text-green-800 dark:text-green-300",
	manual: "bg-blue-500/15 text-blue-800 dark:text-blue-300",
};

type SavedResult = StepResult;

export function GuideStepsCard({ sessionId, toolCallId, input, onDone }: {
	sessionId: string;
	toolCallId: string;
	input: GuideStepsInput;
	onDone: (output: GuideStepsOutput) => PromiseLike<void> | void;
}) {
	const { getToken } = useAuth();
	const [results, setResults] = useState<SavedResult[]>([]);
	const [stepIndex, setStepIndex] = useState(0);
	const [outcome, setOutcome] = useState<StepResult["outcome"] | null>(null);
	const [pastedOutput, setPastedOutput] = useState("");
	const [helpOpen, setHelpOpen] = useState(false);
	const [helpText, setHelpText] = useState("");
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [outputOpen, setOutputOpen] = useState(false);
	const [confirmedDestructive, setConfirmedDestructive] = useState(false);
	const [loadingResults, setLoadingResults] = useState(true);
	const [busy, setBusy] = useState(true);
	const [busyLabel, setBusyLabel] = useState("Loading guide…");
	const [loadError, setLoadError] = useState(false);
	const [copied, setCopied] = useState<string | null>(null);
	const pasteRef = useRef<HTMLTextAreaElement>(null);
	const activeStep = input.steps[stepIndex];
	const apiPath = `/api/sessions/${encodeURIComponent(sessionId)}/guides/${encodeURIComponent(toolCallId)}/results`;
	const helpIsSubmitted = helpOpen && helpText.trim().length > 0;
	const draftResult: StepResult | null = activeStep && (outcome || helpIsSubmitted) ? {
		stepId: activeStep.id,
		outcome: helpIsSubmitted ? "needs_help" : outcome as StepResult["outcome"],
		...(pastedOutput ? { pastedOutput } : {}),
		...(helpIsSubmitted ? { note: helpText.trim() } : {}),
	} : null;
	const returnsToModel = Boolean(activeStep && draftResult && shouldReturnToModel(activeStep, draftResult, stepIndex === input.steps.length - 1));
	const needsCapture = activeStep?.capture === "required" && ["matched_expected", "different_result", "error"].includes(outcome ?? "");
	const needsDestructiveConfirm = Boolean(activeStep?.commands?.some((command) => command.risk === "destructive"));
	const canSubmit = Boolean(draftResult) && (!needsCapture || pastedOutput.trim().length > 0) && (!needsDestructiveConfirm || confirmedDestructive) && !busy;

	useEffect(() => {
		let active = true;
		void (async () => {
			try {
				const token = await getToken();
				const response = await fetch(apiPath, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
				if (!response.ok) throw new Error("load failed");
				const body = await response.json() as { results: SavedResult[] };
				if (!active) return;
				setResults(body.results);
				const firstPending = input.steps.findIndex((step) => !body.results.some((result) => result.stepId === step.id));
				setStepIndex(firstPending < 0 ? input.steps.length - 1 : firstPending);
			} catch {
				if (active) {
					setLoadError(true);
					toast.error("Couldn't load guide progress", "Please try again.");
				}
			} finally {
				if (active) {
					setLoadingResults(false);
					setBusy(false);
				}
			}
		})();
		return () => { active = false; };
	}, [apiPath, getToken, input.steps]);

	const finish = useCallback(async (resultList: SavedResult[], stoppedReason: GuideStepsOutput["stoppedReason"]) => {
		try {
			await onDone({ results: resultList, stoppedReason });
		} catch {
			toast.error("Couldn't send your results", "Your progress is saved. Send a message to continue.");
		}
	}, [onDone]);

	async function submit() {
		if (!activeStep || !draftResult || !canSubmit) return;
		setBusy(true);
		setBusyLabel("Saving…");
		try {
			const token = await getToken();
			const response = await fetch(apiPath, {
				method: "POST",
				headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
				body: JSON.stringify(draftResult),
			});
			if (!response.ok) throw new Error("save failed");
			const body = await response.json() as { result: SavedResult };
			const nextResults = [...results.filter((item) => item.stepId !== body.result.stepId), body.result];
			setResults(nextResults);
			if (activeStep && !shouldReturnToModel(activeStep, body.result, stepIndex === input.steps.length - 1)) {
				setStepIndex(stepIndex + 1);
				setOutcome(null);
				setPastedOutput("");
				setHelpOpen(false);
				setHelpText("");
				setDetailsOpen(false);
				setOutputOpen(false);
				setConfirmedDestructive(false);
				setBusy(false);
				return;
			}
			setBusyLabel("Sending results…");
			await finish(nextResults, stoppedReasonFor(body.result, stepIndex === input.steps.length - 1));
		} catch {
			toast.error("Couldn't save your progress", "Please try again.");
			setBusy(false);
		}
	}

	async function copyCommand(id: string, command: string) {
		await navigator.clipboard.writeText(command);
		setCopied(id);
		window.setTimeout(() => setCopied((current) => current === id ? null : current), 1500);
	}

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canSubmit) {
				event.preventDefault();
				void submit();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	const completed = useMemo(() => input.steps.flatMap((step) => {
		const result = results.find((item) => item.stepId === step.id);
		return result ? [{ step, result }] : [];
	}), [input.steps, results]);

	if (!activeStep || loadingResults) return <section className="w-full max-w-[45rem] rounded-2xl border p-3 text-sm text-muted-foreground sm:p-3.5">{loadError ? "Guide progress is unavailable." : "Loading guide…"}</section>;
	return (
		<section aria-label="Troubleshooting guide" className="w-full max-w-[45rem] rounded-2xl border p-3 text-popover-foreground sm:p-3.5">
			<header className="mb-4 border-b pb-3">
				<div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current step{input.steps.length > 1 ? ` · ${stepIndex + 1} of ${input.steps.length}` : ""}</div>
				<p className="mt-1 text-xs text-muted-foreground">{input.planNote || "Likely path. May change based on your results."}</p>
			</header>
			{completed.length > 0 && <ol className="mb-4 flex flex-col">{completed.map(({ step, result }) => <li className="flex min-w-0 items-center gap-2 border-b px-2 py-2 text-xs last:border-b-0" key={step.id}>
				<Check aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate">{step.title}</span><span className="shrink-0 text-muted-foreground">{outcomeLabel[result.outcome]}</span>
			</li>)}</ol>}
			<div className="flex flex-col gap-4">
				<div>
					<div className="mb-1 flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold">{activeStep.title}</h3><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${kindClass[activeStep.kind]}`}>{kindLabel[activeStep.kind]}</span></div>
					<p className="text-sm text-muted-foreground">{activeStep.why}</p>
				</div>
				<div><h4 className="mb-1.5 text-xs font-medium">Instructions</h4><ol className="flex flex-col gap-1.5 text-sm">{activeStep.instructions.map((instruction, index) => <li className="flex items-start gap-2.5" key={`${index}-${instruction}`}><span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-md bg-foreground/[0.08] text-xs tabular-nums text-muted-foreground">{index + 1}</span><span className="pt-1 leading-relaxed">{instruction}</span></li>)}</ol></div>
				{activeStep.commands?.length ? <div className="flex flex-col gap-3"><h4 className="text-xs font-medium">Commands</h4>{activeStep.commands.map((command, index) => <div className="min-w-0" key={`${activeStep.id}-${index}`}>
					<div className="mb-1 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{command.label}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${command.risk === "destructive" ? "bg-destructive/10 text-destructive" : command.risk === "changes_system" ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-foreground/[0.08] text-muted-foreground"}`}>{riskLabel[command.risk]}</span></div>
					<div className="flex min-w-0 items-center rounded-lg bg-foreground/[0.08]"><pre className="min-w-0 flex-1 overflow-x-auto px-3 py-2 text-xs"><code className="whitespace-pre">{command.command}</code></pre><Button aria-label={`Copy ${command.label}`} className="mr-1" onClick={() => void copyCommand(`${index}`, command.command)} size="xs" type="button" variant="ghost">{copied === `${index}` ? "Copied" : <Copy className="size-3.5" />}</Button></div>
					{command.risk !== "read_only" && command.undo && <p className="mt-1 text-xs text-muted-foreground">To undo: {command.undo}</p>}
				</div>)}</div> : null}
				<div className="text-sm">
					<button aria-expanded={detailsOpen} className="flex min-h-7 cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground" onClick={() => setDetailsOpen((value) => !value)} type="button">What you should see<ChevronDown aria-hidden="true" className={`size-3.5 transition-transform duration-[260ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] ${detailsOpen ? "rotate-180" : ""}`} /></button>
					<div aria-hidden={!detailsOpen} inert={!detailsOpen} className={`grid transition-[grid-template-rows] duration-[260ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] ${detailsOpen ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"}`}><div className="overflow-hidden"><div className="mt-1.5 border-l-2 pl-3"><p className="text-muted-foreground">{activeStep.expected.success}</p>{activeStep.expected.failureSigns?.length ? <><h4 className="mb-1 mt-3 text-xs font-medium">If you see this instead</h4><ul className="list-disc space-y-1 pl-5 text-muted-foreground">{activeStep.expected.failureSigns.map((sign) => <li key={sign}>{sign}</li>)}</ul></> : null}</div></div></div>
				</div>
				{activeStep.capture !== "none" && (outputOpen || outcome ? <div><label className="mb-1.5 block text-xs font-medium" htmlFor={`guide-output-${toolCallId}`}>{activeStep.capturePrompt || "Paste what you see"}{activeStep.capture === "optional" ? " (optional)" : ""}</label><Textarea ref={pasteRef} className="min-h-24 max-h-56 font-mono text-xs" id={`guide-output-${toolCallId}`} maxLength={10000} onChange={(event) => setPastedOutput(event.target.value)} placeholder="Paste output here" value={pastedOutput} /><div className="mt-1 flex justify-between gap-2 text-[11px] text-muted-foreground"><span>Remove passwords and tokens before pasting.</span><span className="shrink-0 tabular-nums">{pastedOutput.length}/10000</span></div></div> : <button className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => setOutputOpen(true)} type="button">{activeStep.capture === "required" ? "Add what you saw" : "Add what you saw (optional)"}</button>)}
				<fieldset><legend className="mb-2 text-xs font-medium">Report back</legend><div className="grid grid-cols-2 gap-2">{outcomeOptions.map(([value, label]) => <Button aria-pressed={outcome === value && !helpIsSubmitted} className="h-auto min-h-9 whitespace-normal px-2 py-2 text-xs" key={value} onClick={() => { setOutcome(value); setHelpOpen(false); }} type="button" variant={outcome === value && !helpIsSubmitted ? "secondary" : "outline"}><Circle className={`mr-1.5 size-3 shrink-0 ${outcome === value && !helpIsSubmitted ? "fill-current" : ""}`} />{label}</Button>)}</div></fieldset>
				{helpOpen && <Textarea aria-label="What's unclear?" maxLength={500} onChange={(event) => setHelpText(event.target.value)} placeholder="What's unclear?" value={helpText} />}
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs"><button className="text-primary underline-offset-4 hover:underline" onClick={() => { setHelpOpen(!helpOpen); setOutcome(null); }} type="button">I need help with this step</button><button className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => void finish(results, "user_skipped")} type="button">Skip this guide</button></div>
				{needsDestructiveConfirm && <label className="flex cursor-pointer items-start gap-2 text-xs"><Checkbox checked={confirmedDestructive} onCheckedChange={(checked) => setConfirmedDestructive(checked === true)} /><span>I understand this can't be undone easily.</span></label>}
				<div className="flex justify-end"><Button className="w-full sm:w-auto" disabled={!canSubmit} onClick={() => void submit()} type="button">{busy ? <><Spinner className="size-3.5" />{busyLabel}</> : returnsToModel ? "Send results" : "Continue"}</Button></div>
			</div>
		</section>
	);
}

