import { useConvexAuth, useQuery } from "convex/react";
import { X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useCreditsNotice } from "@/components/credits-notice-store";
import { useSettings } from "@/components/settings-store";
import { useSidebar } from "@/components/ui/sidebar";

const SHOW_AT_PERCENT = 20;

export function CreditsNotice() {
	const { isAuthenticated } = useConvexAuth();
	const { open: sidebarOpen } = useSidebar();
	const credits = useQuery(
		api.credits.getMyCredits,
		isAuthenticated ? {} : "skip"
	);
	const dismissedForPeriod = useCreditsNotice(
		(state) => state.dismissedForPeriod
	);
	const dismiss = useCreditsNotice((state) => state.dismiss);
	const openSettings = useSettings((state) => state.openSettings);

	if (!sidebarOpen || !credits?.synced) {
		return null;
	}
	const credited = credits.creditedUnits;
	const available = credits.available;
	if (!credited || available === null) {
		return null;
	}
	const percent = Math.max(
		0,
		Math.min(100, Math.round((available / credited) * 100))
	);
	if (percent > SHOW_AT_PERCENT) {
		return null;
	}
	const periodKey = String(credits.periodEnd ?? "current");
	if (dismissedForPeriod === periodKey) {
		return null;
	}

	const resetLabel = credits.periodEnd
		? `${new Date(credits.periodEnd).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			})} at ${new Date(credits.periodEnd).toLocaleTimeString(undefined, {
				hour: "numeric",
				minute: "2-digit",
			})}`
		: null;
	const exhausted = available <= 0;

	return (
		<div className="relative mb-2 rounded-md border border-sidebar-border bg-background p-3 text-foreground shadow-sm">
			<button
				aria-label="Dismiss credits notice"
				className="absolute top-2 right-2 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				onClick={() => dismiss(periodKey)}
				type="button"
			>
				<X aria-hidden="true" className="size-3.5" />
			</button>
			<button
				className="block w-full cursor-pointer text-left"
				onClick={() => openSettings("billing")}
				type="button"
			>
				<p className="font-semibold text-sm">
					{percent}% usage remaining
				</p>
				<p className="mt-0.5 pr-5 text-muted-foreground text-xs">
					Resets every month
					{resetLabel ? ` · Next reset is on ${resetLabel}` : ""}
				</p>
				<div
					aria-hidden="true"
					className="mt-2.5 h-1.5 w-full overflow-hidden rounded-sm bg-zinc-300 dark:bg-zinc-600"
				>
					<div
						className={`h-full rounded-sm transition-all ${
							exhausted ? "bg-destructive" : "bg-amber-500"
						}`}
						style={{ width: `${percent}%` }}
					/>
				</div>
				{exhausted ? (
					<p className="mt-1.5 text-destructive text-xs">
						New messages are paused until your credits reset.
					</p>
				) : null}
			</button>
		</div>
	);
}
