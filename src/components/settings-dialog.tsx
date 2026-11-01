import { UserProfile } from "@clerk/tanstack-react-start";
import { Check, CreditCard, ShieldCheck, UserRound, X } from "lucide-react";
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
	return (
		<div className="flex flex-col gap-4 pt-2">
			<div>
				<h3 className="font-medium text-base">Free Beta</h3>
				<p className="text-muted-foreground text-sm">
					Everything you need to try Phixr and help us improve it.
				</p>
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
