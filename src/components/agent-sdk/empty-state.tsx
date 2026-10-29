import { ArrowUpRight, Bug, CircleHelp, Gauge, Wifi } from "lucide-react";
import { PhixrIcon } from "#/components/phixr-icon";
import { SidebarTrigger, useSidebar } from "#/components/ui/sidebar";
import { cn } from "#/lib/utils";

const suggestions = [
	{
		icon: Bug,
		iconClassName: "text-rose-500",
		label: "Fix an app that keeps crashing",
		prompt: "Help me figure out why this app keeps crashing.",
	},
	{
		icon: Wifi,
		iconClassName: "text-sky-500",
		label: "Troubleshoot a connection problem",
		prompt: "Help me troubleshoot a connection problem.",
	},
	{
		icon: Gauge,
		iconClassName: "text-emerald-600",
		label: "Make my device run faster",
		prompt: "Help me figure out why my device is running slowly.",
	},
	{
		icon: CircleHelp,
		iconClassName: "text-violet-500",
		label: "Understand an error message",
		prompt: "Help me understand and fix an error message.",
	},
];

export function EmptyState({
	className,
	onSubmit,
}: {
	className?: string;
	onSubmit?: (message: string, attachments: Array<{ url: string; filename: string; mediaType: string }>) => void | Promise<void>;
}) {
	const { isMobile, open, openMobile } = useSidebar();
	const showSidebarTrigger = isMobile ? !openMobile : !open;

	return (
		<div
			className={cn(
				"relative flex min-h-0 w-full flex-1 flex-col items-center px-4 pt-6 sm:pt-8",
				className
			)}
		>
			{showSidebarTrigger && <SidebarTrigger className="absolute top-2 left-3" size="icon-xs" />}
			<div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-7 py-8 sm:gap-8">
				<PhixrIcon className="mx-auto size-9 text-primary" />
				<h1 className="text-center text-2xl tracking-tight sm:text-[28px]">
					What should we fix?
				</h1>
				<div className="mx-auto grid w-full max-w-[45rem] grid-cols-2 gap-2.5 sm:gap-3">
					{suggestions.map(({ icon: Icon, iconClassName, label, prompt }) => (
						<button
							className="group flex min-h-28 cursor-pointer flex-col items-start justify-between gap-4 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-36 sm:p-4"
							key={label}
							onClick={() => onSubmit?.(prompt, [])}
							type="button"
						>
							<div className="flex w-full items-center justify-between">
								<Icon aria-hidden="true" className={cn("size-4", iconClassName)} />
								<ArrowUpRight aria-hidden="true" className="size-3.5 -translate-x-1 translate-y-1 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:translate-y-0 group-focus-visible:opacity-100" />
							</div>
							<span className="text-xs font-medium leading-relaxed sm:text-sm">
								{label}
							</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
