import { useMutation } from "convex/react";
import { Check, Circle, Flag } from "lucide-react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "#/components/ui/button";
import { Spinner } from "#/components/ui/spinner";
import { toast } from "#/lib/toast";
import type { ResolutionInput, ResolutionOutput } from "#/lib/resolution/schema";

function SummaryFields({ input }: { input: ResolutionInput }) {
	return (
		<dl className="flex flex-col gap-2.5">
			<div className="grid gap-0.5">
				<dt className="flex items-center gap-2 text-xs text-muted-foreground">
					{input.causeConfirmed ? "Cause" : "Most likely cause"}
					<span className={`rounded-full px-1.5 py-px text-[10px] font-medium ${input.causeConfirmed ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
						{input.causeConfirmed ? "Confirmed" : "Likely"}
					</span>
				</dt>
				<dd className="text-sm leading-relaxed">{input.cause}</dd>
			</div>
			<div className="grid gap-0.5">
				<dt className="text-xs text-muted-foreground">What fixed it</dt>
				<dd className="text-sm leading-relaxed">{input.fixSummary}</dd>
			</div>
			{input.changesMade?.length ? (
				<div className="grid gap-0.5">
					<dt className="text-xs text-muted-foreground">Changes made</dt>
					<dd>
						<ul className="list-disc space-y-0.5 pl-5 text-sm leading-relaxed">
							{input.changesMade.map((change) => <li key={change}>{change}</li>)}
						</ul>
					</dd>
				</div>
			) : null}
			{input.ifItReturns ? (
				<div className="grid gap-0.5">
					<dt className="text-xs text-muted-foreground">If it comes back</dt>
					<dd className="text-sm leading-relaxed">{input.ifItReturns}</dd>
				</div>
			) : null}
		</dl>
	);
}

export function ResolutionCard({ sessionId, input, onDone }: {
	sessionId: string;
	input: ResolutionInput;
	onDone: (output: ResolutionOutput) => PromiseLike<void> | void;
}) {
	const setStatus = useMutation(api.sessions.setStatus);
	const [busy, setBusy] = useState<ResolutionOutput["status"] | null>(null);

	async function choose(status: ResolutionOutput["status"]) {
		setBusy(status);
		try {
			// The session only earns its status from the user's answer:
			// resolved when they confirm the fix, back to active when not.
			if (status === "confirmed_fixed") {
				await setStatus({ chatId: sessionId, status: "resolved" });
			} else if (status === "still_broken") {
				await setStatus({ chatId: sessionId, status: "active" });
			}
			await onDone({ status });
		} catch {
			toast.error("Couldn't record that", "Please try again.");
			setBusy(null);
		}
	}

	return (
		<section aria-label="Confirm the fix" className="w-full max-w-[45rem] rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
			<header className="mb-3 flex items-start gap-3">
				<span className="grid size-8 shrink-0 place-items-center rounded-full bg-green-500/15 text-green-700 dark:text-green-300">
					<Flag aria-hidden="true" className="size-4" />
				</span>
				<div className="min-w-0 flex-1">
					<h3 className="text-sm font-medium">Did that fix it?</h3>
					<p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
						This is what the evidence points to. Confirm the original problem is gone and the session will be marked resolved.
					</p>
				</div>
			</header>
			<SummaryFields input={input} />
			<div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
				<Button disabled={busy !== null} onClick={() => void choose("confirmed_fixed")} size="sm" type="button">
					{busy === "confirmed_fixed" ? <Spinner className="size-3.5" /> : <Check aria-hidden="true" className="size-3.5" />}
					It&rsquo;s fixed
				</Button>
				<Button disabled={busy !== null} onClick={() => void choose("still_broken")} size="sm" type="button" variant="outline">
					{busy === "still_broken" ? <Spinner className="size-3.5" /> : null}
					Still happening
				</Button>
				<Button disabled={busy !== null} onClick={() => void choose("not_sure")} size="sm" type="button" variant="ghost">
					{busy === "not_sure" ? <Spinner className="size-3.5" /> : null}
					Not sure yet
				</Button>
			</div>
		</section>
	);
}

export function ResolutionSummary({ input, output }: { input: ResolutionInput; output: ResolutionOutput }) {
	const confirmed = output.status === "confirmed_fixed";
	const stillBroken = output.status === "still_broken";
	const title = confirmed ? "Marked as fixed" : stillBroken ? "Still happening" : "Not confirmed yet";
	const description = confirmed
		? "You confirmed the original problem is resolved."
		: stillBroken
			? "Phixr will keep working on it from here."
			: "Check the original problem when you can, then say the word.";
	return (
		<section aria-label={title} className="w-full max-w-[45rem] rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
			<header className="mb-3 flex items-start gap-3">
				<span className={`grid size-8 shrink-0 place-items-center rounded-full ${confirmed ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
					{confirmed ? <Check aria-hidden="true" className="size-4" /> : <Circle aria-hidden="true" className="size-3" />}
				</span>
				<div className="min-w-0 flex-1">
					<h3 className="text-sm font-medium">{title}</h3>
					<p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
				</div>
			</header>
			<SummaryFields input={input} />
		</section>
	);
}
