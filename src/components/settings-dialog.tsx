import { UserProfile } from "@clerk/tanstack-react-start";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Check, CreditCard, ShieldCheck, UserRound, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { clerkSettingsAppearance } from "@/lib/clerk-appearance";

export type SettingsTab = "account" | "security" | "billing";

const SETTINGS_NAV: Array<{
	value: SettingsTab;
	label: string;
	icon: typeof UserRound;
}> = [
	{ value: "account", label: "Account", icon: UserRound },
	{ value: "security", label: "Security", icon: ShieldCheck },
	{ value: "billing", label: "Billing", icon: CreditCard },
];

const SETTINGS_PAGE_META: Record<SettingsTab, { title: string; description: string }> = {
	account: {
		title: "Account",
		description: "Manage your profile, avatar, and email addresses.",
	},
	security: {
		title: "Security",
		description: "Manage your password, active sessions, and multi-factor authentication.",
	},
	billing: {
		title: "Billing",
		description: "Manage your plan and view your invoices.",
	},
};

const FREE_PLAN_FEATURES = [
	"100 free troubleshooting credits",
	"AI-powered problem diagnosis",
	"Personalized troubleshooting questions",
	"Step-by-step repair guidance",
	"Adaptive troubleshooting based on your results",
	"Saved troubleshooting history",
	"Access to beta improvements",
];

function BillingPanel() {
	const { isAuthenticated } = useConvexAuth();
	const credits = useQuery(api.credits.getMyCredits, isAuthenticated ? {} : "skip");
	const refreshCredits = useAction(api.credits.refreshMyCredits);
	const refreshedRef = useRef(false);
	useEffect(() => {
		if (!isAuthenticated || refreshedRef.current) return;
		refreshedRef.current = true;
		void refreshCredits({}).catch(() => undefined);
	}, [isAuthenticated, refreshCredits]);

	const balance = credits?.balance ?? null;
	const available = credits?.available ?? balance;
	const credited = credits?.creditedUnits ?? 0;
	const percent =
		credited > 0 && available !== null
			? Math.max(0, Math.min(100, (available / credited) * 100))
			: 0;
	const exhausted = available !== null && available <= 0;
	const low = !exhausted && available !== null && available < 20;
	const resetLabel = credits?.periodEnd
		? new Date(credits.periodEnd).toLocaleDateString(undefined, {
				month: "long",
				day: "numeric",
				year: "numeric",
			})
		: null;

	return (
		<div className="flex flex-col gap-4 pt-2">
			<div>
				<h3 className="font-medium text-base">Free Beta</h3>
				<p className="text-muted-foreground text-sm">
					Everything you need to try Phixr and help us improve it.
				</p>
			</div>

			<div className="rounded-lg border p-4">
				{credits === undefined ? (
					<div className="flex flex-col gap-2">
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-2.5 w-full" />
						<Skeleton className="h-4 w-56" />
					</div>
				) : (
					<div className="flex flex-col gap-2">
						<div className="flex items-baseline justify-between gap-3">
							<p className="font-medium text-sm">AI credits</p>
							<p className="text-sm tabular-nums">
								{available === null
									? "Syncing…"
									: `${Math.max(0, available)} of ${credited} credits`}
							</p>
						</div>
						<div
							aria-hidden="true"
							className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
						>
							<div
								className={`h-full rounded-full transition-all ${
									exhausted
										? "bg-destructive"
										: low
											? "bg-amber-500"
											: "bg-green-600 dark:bg-green-400"
								}`}
								style={{ width: `${percent}%` }}
							/>
						</div>
						<p className="text-muted-foreground text-xs">
							{credits?.synced
								? `${credits.consumedUnits} used this period${resetLabel ? ` · Resets ${resetLabel}` : ""}${credits.reservedCredits ? ` · ${credits.reservedCredits} reserved by an in-progress reply` : ""}`
								: "Your credit balance is still syncing. Chat remains available."}
						</p>
						{exhausted ? (
							<p className="text-destructive text-xs">
								You are out of credits. New messages are paused until your
								credits reset{resetLabel ? ` on ${resetLabel}` : ""}.
							</p>
						) : low ? (
							<p className="text-amber-600 text-xs dark:text-amber-400">
								You are running low on credits for this period.
							</p>
						) : null}
						<p className="text-muted-foreground text-xs">
							A message costs 1–3 credits depending on whether Phixr
							researches the web or builds a guide or questionnaire.
							Viewing past chats is always free.
						</p>
					</div>
				)}
			</div>

			<div>
				<ul className="flex flex-col gap-2.5">
					{FREE_PLAN_FEATURES.map((feature) => (
						<li className="flex items-start gap-2.5 text-sm" key={feature}>
							<Check
								aria-hidden="true"
								className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400"
							/>
							<span>{feature}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

export function SettingsDialog({
	open,
	onOpenChange,
	tab,
	onTabChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tab: SettingsTab;
	onTabChange: (tab: SettingsTab) => void;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				className="flex h-[min(92dvh,48rem)] w-[min(96vw,72rem)] flex-col overflow-hidden border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
				hideCloseButton
			>
				<DialogTitle className="sr-only">Settings</DialogTitle>
				<DialogDescription className="sr-only">
					Manage your account, security, and billing.
				</DialogDescription>

				<div className="flex min-h-0 flex-1 flex-col sm:flex-row">
					<nav
						aria-label="Settings"
						className="shrink-0 border-sidebar-border border-b p-3 sm:w-52 sm:border-r sm:border-b-0"
					>
						<p className="hidden px-2 pt-1 pb-2 text-sidebar-foreground/50 text-xs sm:block">
							Preferences
						</p>
						<div className="flex gap-1 sm:flex-col">
							{SETTINGS_NAV.map((item) => (
								<button
									aria-current={tab === item.value ? "page" : undefined}
									className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
										tab === item.value
											? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
											: "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
									}`}
									key={item.value}
									onClick={() => onTabChange(item.value)}
									type="button"
								>
									<item.icon aria-hidden="true" className="size-4 shrink-0" />
									<span>{item.label}</span>
								</button>
							))}
						</div>
					</nav>

					<div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
						<DialogClose
							render={
								<Button
									aria-label="Close settings"
									className="absolute top-3 right-3 z-10"
									size="icon-sm"
									variant="secondary"
								/>
							}
						>
							<X aria-hidden="true" />
						</DialogClose>
						<div className="min-h-0 flex-1 overflow-hidden px-6 pt-5 pb-5 sm:px-9 sm:pb-6">
							<div className="mb-3 pb-3 pe-10">
								<h2 className="font-medium text-lg">{SETTINGS_PAGE_META[tab].title}</h2>
								<p className="text-muted-foreground text-sm">
									{SETTINGS_PAGE_META[tab].description}
								</p>
							</div>
							{tab === "billing" ? (
								<BillingPanel />
							) : (
							// Clerk navigates virtually inside the dialog (no URL
							// changes). Its types only list path/hash, but the
							// runtime supports "virtual" — Clerk's own modals use
							// it. Like moflay, the active page is listed first;
							// `key` remounts so switching tabs lands on it.
							<UserProfile
								appearance={clerkSettingsAppearance}
								routing={"virtual" as "hash"}
								fallback={
									<div className="flex justify-center py-16">
										<Spinner size={24} />
									</div>
								}
								key={tab}
							>
								{/* Direct children, exactly like moflay — Clerk reads
								    the Page order from its immediate children. */}
								{tab === "account" ? (
									<UserProfile.Page label="account" />
								) : (
									<UserProfile.Page label="security" />
								)}
								{tab === "account" ? (
									<UserProfile.Page label="security" />
								) : (
									<UserProfile.Page label="account" />
								)}
							</UserProfile>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
