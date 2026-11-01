import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SessionRecencyGroupLabel = "Today" | "Yesterday" | "Last 7 days" | "Older";

type SidebarSessionGroupsState = {
	openByLabel: Partial<Record<SessionRecencyGroupLabel, boolean>>;
	setOpen: (label: SessionRecencyGroupLabel, open: boolean) => void;
};

export const useSidebarSessionGroups = create<SidebarSessionGroupsState>()(
	persist(
		(set) => ({
			openByLabel: {},
			setOpen: (label, open) =>
				set((state) => ({ openByLabel: { ...state.openByLabel, [label]: open } })),
		}),
		{ name: "phixr:sidebar-session-groups" }
	)
);
