"use client";

import { Toast } from "@base-ui/react/toast";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "#/lib/utils";

export const toastManager = Toast.createToastManager();

const toastIcons = {
	error: CircleAlertIcon,
	info: InfoIcon,
	loading: LoaderCircleIcon,
	success: CircleCheckIcon,
	warning: TriangleAlertIcon,
} as const;

export function ToastProvider({ children, timeout = 2000 }: { children: ReactNode; timeout?: number }) {
	return <Toast.Provider toastManager={toastManager} timeout={timeout}>{children}<ToastViewport /></Toast.Provider>;
}

function ToastViewport() {
	const { toasts } = Toast.useToastManager();
	return <Toast.Portal>
		<Toast.Viewport className="fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-90 flex-col gap-3 outline-none">
			{toasts.map((item) => {
				const Icon = item.type && item.type in toastIcons ? toastIcons[item.type as keyof typeof toastIcons] : null;
				return <Toast.Root className="rounded-lg border bg-popover p-3.5 text-popover-foreground shadow-lg data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0" key={item.id} toast={item}>
					<Toast.Content className="flex items-center gap-2.5 text-sm">
						{Icon ? <Icon className={cn("size-4 shrink-0", item.type === "error" && "text-destructive", item.type === "loading" && "animate-spin")} /> : null}
						<span className="flex min-w-0 flex-col gap-0.5"><Toast.Title className="font-medium" /><Toast.Description className="text-muted-foreground" /></span>
					</Toast.Content>
				</Toast.Root>;
			})}
		</Toast.Viewport>
	</Toast.Portal>;
}
