import { Archive, Check, Clock } from "lucide-react";
import type { ReactNode } from "react";

export type SessionStatusInfo = {
	status: "active" | "resolved" | "archived";
	awaitingUser?: boolean;
};

export function sessionStatusDisplay({ status, awaitingUser }: SessionStatusInfo): {
	label: string;
	icon: ReactNode;
} {
	if (status === "resolved") {
		return {
			label: "Resolved",
			icon: (
				<span className="grid size-3.5 shrink-0 place-items-center rounded-full bg-green-500/15 text-green-700 dark:text-green-300">
					<Check aria-hidden="true" className="size-2!" />
				</span>
			),
		};
	}
	if (status === "archived") {
		return {
			label: "Archived",
			icon: <Archive aria-hidden="true" className="size-3! shrink-0 text-sidebar-foreground/40" />,
		};
	}
	if (awaitingUser) {
		return {
			label: "Waiting on you",
			icon: <Clock aria-hidden="true" className="size-3! shrink-0 text-amber-600 dark:text-amber-400" />,
		};
	}
	return {
		label: "In progress",
		icon: <span aria-hidden="true" className="size-[5px] shrink-0 rounded-full bg-sky-500" />,
	};
}

export function SessionStatusIcon({ status, awaitingUser }: SessionStatusInfo) {
	const { icon } = sessionStatusDisplay({ status, awaitingUser });
	return (
		<span aria-hidden="true" className="grid size-4 shrink-0 place-items-center">
			{icon}
		</span>
	);
}
