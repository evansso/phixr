import { formatDistanceToNowStrict } from "date-fns";
import { Tooltip, TooltipPopup, TooltipTrigger } from "#/components/ui/tooltip";

export function MessageTime({ createdAt }: { createdAt: Date }) {
	const rawTime = formatDistanceToNowStrict(createdAt, {
		addSuffix: true,
		roundingMethod: "floor",
	});
	const relativeTime = rawTime.startsWith("less than a minute")
		? "now"
		: rawTime
				.replace(/^(about|less than|almost|over) /, "")
				.replace(" months", "mo")
				.replace(" month", "mo")
				.replace(" years", "y")
				.replace(" year", "y")
				.replace(" weeks", "w")
				.replace(" week", "w")
				.replace(" days", "d")
				.replace(" day", "d")
				.replace(" hours", "h")
				.replace(" hour", "h")
				.replace(" minutes", "m")
				.replace(" minute", "m")
				.replace(" seconds", "s")
				.replace(" second", "s");

	return (
		<Tooltip>
			<TooltipTrigger
				className="px-1 text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
				delay={0}
				tabIndex={0}
			>
				{relativeTime}
			</TooltipTrigger>
			<TooltipPopup>
				{createdAt.toLocaleString(undefined, {
					day: "numeric",
					month: "long",
					year: "numeric",
					hour: "numeric",
					minute: "2-digit",
				})}
			</TooltipPopup>
		</Tooltip>
	);
}
