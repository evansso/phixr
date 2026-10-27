import type { GuideStepsInput, GuideStepsOutput } from "#/lib/guide-steps/schema";
import { Check, Circle, ListChecks } from "lucide-react";

const outcomeLabel: Record<string, string> = {
	matched_expected: "Accepted", different_result: "Different", error: "Error",
	could_not_run: "Couldn't run", needs_help: "Needed help", interrupted: "Interrupted",
};

export function GuideStepsSummary({ input, output }: { input: GuideStepsInput; output: GuideStepsOutput }) {
	const complete = output.stoppedReason === "batch_complete";
	const title = complete ? "Steps completed" : output.stoppedReason === "user_skipped" ? "Guide skipped" : "Results sent to Phixr";
	const description = complete
		? "You confirmed the expected results for these steps."
		: output.stoppedReason === "user_skipped"
			? "You skipped the remaining steps."
			: "Phixr will use these results to choose what to do next.";
	return (
		<section aria-label={title} className="w-full max-w-[45rem] rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
			<header className="mb-3 flex items-start gap-3">
				<span className={`grid size-8 shrink-0 place-items-center rounded-full ${complete ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
					{complete ? <Check aria-hidden="true" className="size-4" /> : <ListChecks aria-hidden="true" className="size-4" />}
				</span>
				<div className="min-w-0 flex-1">
					<h3 className="text-sm font-medium">{title}</h3>
					<p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
				</div>
				<span className="shrink-0 text-xs tabular-nums text-muted-foreground">{output.results.length} {output.results.length === 1 ? "step" : "steps"}</span>
			</header>
			{output.results.length > 0 ? (
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
			) : null}
		</section>
	);
}
