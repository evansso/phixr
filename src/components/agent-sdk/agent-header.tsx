import type { ReactNode } from "react";
import { cn } from "#/lib/utils";

export function AgentHeader({
	children,
	className,
}: {
	children?: ReactNode;
	className?: string;
}) {
	return (
		<header
			className={cn("flex shrink-0 items-center border-b px-4 py-3", className)}
		>
			{children}
		</header>
	);
}
