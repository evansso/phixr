import { create } from "zustand";
import type { SettingsTab } from "@/components/settings-dialog";

type SettingsState = {
	open: boolean;
	tab: SettingsTab;
	setOpen: (open: boolean) => void;
	setTab: (tab: SettingsTab) => void;
	openSettings: (tab: SettingsTab) => void;
};

export const useSettings = create<SettingsState>()((set) => ({
	open: false,
	tab: "account",
	setOpen: (open) => set({ open }),
	setTab: (tab) => set({ tab }),
	openSettings: (tab) => set({ tab, open: true }),
}));
