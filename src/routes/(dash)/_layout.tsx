import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { AgentChat } from "@/components/agent-sdk/agent-chat";
import { ChatSessionProvider } from "@/components/agent-sdk/chat-session-store";
import { AppSidebar } from "@/components/app-sidebar";
import { Spinner } from "@/components/spinner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const getSidebarDefaultOpen = createServerFn({ method: "GET" }).handler(() => {
	return getCookie("sidebar_state") !== "false";
});

export const Route = createFileRoute("/(dash)/_layout")({
	loader: () => getSidebarDefaultOpen(),
	component: DashboardLayout,
	pendingComponent: () => (
		<div className="flex h-svh w-full items-center justify-center">
			<Spinner />
		</div>
	),
});

function DashboardLayout() {
	const sidebarDefaultOpen = Route.useLoaderData();
	const pathname = useLocation({ select: (location) => location.pathname });
	const chatMatch = pathname.match(/^\/c\/([^/]+)$/);
	const isNewChat = pathname === "/new";
	const chatId = chatMatch ? decodeURIComponent(chatMatch[1]) : undefined;

	return (
		<ChatSessionProvider>
			<SidebarProvider className="h-svh overflow-hidden" defaultOpen={sidebarDefaultOpen}>
				<AppSidebar />
				<SidebarInset className="min-h-0 overflow-hidden">
					<main className="flex min-h-0 flex-1 flex-col">
						<AgentChat chatId={chatId} isNewChat={isNewChat} />
						<Outlet />
					</main>
				</SidebarInset>
			</SidebarProvider>
		</ChatSessionProvider>
	);
}
