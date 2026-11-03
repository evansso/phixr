import { create } from "zustand";
import { persist } from "zustand/middleware";

type CreditsNoticeState = {
	dismissedForPeriod: string | null;
	dismiss: (periodKey: string) => void;
};

export const useCreditsNotice = create<CreditsNoticeState>()(
	persist(
		(set) => ({
			dismissedForPeriod: null,
			dismiss: (periodKey) => set({ dismissedForPeriod: periodKey }),
		}),
		{ name: "phixr:credits-notice" }
	)
);
