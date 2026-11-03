import { useConvexAuth, useQuery } from "convex/react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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

	const credited = credits?.creditedUnits ?? 0;
	const available = credits?.available ?? null;
	const percent =
		credited > 0 && available !== null
			? Math.max(0, Math.min(100, Math.round((available / credited) * 100)))
			: null;
	const periodKey = String(credits?.periodEnd ?? "current");
	const visible = Boolean(
		sidebarOpen &&
			credits?.synced &&
			percent !== null &&
			percent <= SHOW_AT_PERCENT &&
			dismissedForPeriod !== periodKey
	);

	const resetLabel = credits?.periodEnd
		? `${new Date(credits.periodEnd).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			})} at ${new Date(credits.periodEnd).toLocaleTimeString(undefined, {
				hour: "numeric",
				minute: "2-digit",
			})}`
		: null;
	const exhausted = available !== null && available <= 0;
	const availableLabel =
		available !== null
			? Math.max(0, Math.round(available)).toLocaleString()
			: "0";
	const creditedLabel = credited.toLocaleString();

	return (
		<AnimatePresence initial={false}>
			{visible ? (
				<motion.div
					animate={{ height: "auto", opacity: 1 }}
					className="overflow-hidden"
					exit={{ height: 0, opacity: 0 }}
					initial={{ height: 0, opacity: 0 }}
					transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
				>
					<div className="pb-2">
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="relative rounded-lg border border-sidebar-border bg-background p-3 text-foreground shadow-sm"
							exit={{ opacity: 0, y: 4 }}
							initial={{ opacity: 0, y: 8 }}
							transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
						>
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
							<p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
								{availableLabel} of {creditedLabel} credits left
							</p>
							<p className="mt-0.5 pr-5 text-muted-foreground text-xs">
								Resets every month
								{resetLabel ? ` · Next reset is on ${resetLabel}` : ""}
							</p>
							<div
								aria-hidden="true"
								className="mt-2.5 h-1.5 w-full overflow-hidden rounded-sm bg-zinc-300 dark:bg-zinc-600"
							>
								<motion.div
									animate={{ width: `${percent}%` }}
									className={`h-full rounded-sm ${
										exhausted ? "bg-destructive" : "bg-amber-500"
									}`}
									initial={false}
									transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
								/>
							</div>
							{exhausted ? (
								<p className="mt-1.5 text-destructive text-xs">
									New messages are paused until your credits reset.
								</p>
							) : null}
						</button>
						</motion.div>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
