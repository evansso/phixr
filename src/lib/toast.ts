import { toastManager } from "#/components/ui/toast";

export const toast = {
	success: (message: string, description?: string) => toastManager.add({ title: message, description, type: "success" }),
	error: (message: string, description?: string) => toastManager.add({ title: message, description, type: "error" }),
	info: (message: string, description?: string) => toastManager.add({ title: message, description, type: "info" }),
	warning: (message: string, description?: string) => toastManager.add({ title: message, description, type: "warning" }),
	loading: (message: string, description?: string) => toastManager.add({ title: message, description, type: "loading" }),
};
