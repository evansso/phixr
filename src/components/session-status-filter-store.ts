import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SessionStatusFilter =
	| "in-progress"
	| "waiting"
	| "resolved"
	| "archived";

export const ALL_SESSION_STATUS_FILTERS: SessionStatusFilter[] = [
	"in-progress",
	"waiting",
	"resolved",
	"archived",
];

type SessionStatusFilterState = {
	selectedByUser: Record<string, SessionStatusFilter[]>;
	setSelected: (userId: string, selected: SessionStatusFilter[]) => void;
};

export const useSessionStatusFilter = create<SessionStatusFilterState>()(
	persist(
		(set) => ({
			selectedByUser: {},
			setSelected: (userId, selected) =>
				set((state) => ({
					selectedByUser: { ...state.selectedByUser, [userId]: selected },
				})),
		}),
		{ name: "phixr:session-status-filter" }
	)
);

export function sessionStatusFilterKey(session: {
	status: "active" | "resolved" | "archived";
	awaitingUser?: boolean;
}): SessionStatusFilter {
	if (session.status === "resolved") return "resolved";
	if (session.status === "archived") return "archived";
	return session.awaitingUser ? "waiting" : "in-progress";
}
