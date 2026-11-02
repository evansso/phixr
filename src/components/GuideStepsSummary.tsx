import type { GuideStepsInput, GuideStepsOutput } from "#/lib/guide-steps/schema";
import { Check, ChevronDown, Circle, ListChecks } from "lucide-react";
import { useState } from "react";

const outcomeLabel: Record<string, string> = {
	matched_expected: "Accepted", different_result: "Different", error: "Error",
	could_not_run: "Couldn't run", needs_help: "Needed help", interrupted: "Interrupted",
};

/**
 * A completed guide batch is history: it renders as a one-line header
 * (title + step/outcome counts) that expands to the full per-step
 * results. Sequential batches therefore stack as a compact progress
 * log instead of full cards, and none of them disappear.
 */
export function GuideStepsSummary({ input, output }: { input: GuideStepsInput; output: GuideStepsOutput }) {
	const [open, setOpen] = useState(false);
	const complete = output.stoppedReason === "batch_complete";
	const title = complete ? "Steps completed" : output.stoppedReason === "user_skipped" ? "Guide skipped" : "Results sent to Phixr";
	const description = complete
		? "You confirmed the expected results for these steps."
		: output.stoppedReason === "user_skipped"
			? "You skipped the remaining steps."
			: "Phixr will use these results to choose what to do next.";
	const counts = new Map<string, number>();
	for (const result of output.results) {
		const label = outcomeLabel[result.outcome] ?? result.outcome;
		counts.set(label, (counts.get(label) ?? 0) + 1);
	}
	const summary = [
		`${output.results.length} ${output.results.length === 1 ? "step" : "steps"}`,
		...[...counts.entries()].map(([label, count]) => `${count} ${label.toLowerCase()}`),
	].join(" · ");
	const expandable = output.results.length > 0;
	return (
		<section aria-label={title} className="w-full max-w-[45rem] rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
			<button
				aria-expanded={expandable ? open : undefined}
				className="flex w-full cursor-pointer items-start gap-3 text-left disabled:cursor-default"
				disabled={!expandable}
				onClick={() => setOpen((value) => !value)}
				type="button"
			>
				<span className={`grid size-8 shrink-0 place-items-center rounded-full ${complete ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
					{complete ? <Check aria-hidden="true" className="size-4" /> : <ListChecks aria-hidden="true" className="size-4" />}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-medium">{title}</span>
					<span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{summary}</span>
				</span>
				{expandable ? <ChevronDown aria-hidden="true" className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-[260ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] ${open ? "rotate-180" : ""}`} /> : null}
			</button>
			{expandable && open ? (
				<div className="mt-3">
					<p className="mb-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
					<ol className="flex flex-col divide-y rounded-lg border">
						{output.results.map((result) => {
							const accepted = result.outcome === "matched_expected";
							return (
								<li className="flex min-w-0 items-center gap-2.5 px-3 py-2" key={result.stepId}>
									<span className={`grid size-6 shrink-0 place-items-center rounded-md ${accepted ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
										{accepted ? <Check aria-hidden="true" className="size-3.5" /> : <Circle aria-hidden="true" className="size-3" />}
									</span>
									<span className="min-w-0 flex-1 truncate text-sm">{input.steps.find((step) => step.id === result.stepId)?.title ?? result.stepId}</span>
									<span className="shrink-0 text-xs text-muted-foreground">{outcomeLabel[result.outcome]}</span>
								</li>
							);
						})}
					</ol>
				</div>
			) : null}
		</section>
	);
}
