import { Show, UserButton } from "@clerk/tanstack-react-start";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { Logo } from "@/components/logo";
import { useChatSession } from "@/components/agent-sdk/chat-session-store";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../convex/_generated/api";

export function AppSidebar() {
	const beginNewChat = useChatSession((state) => state.beginNewChat);
	const matchRoute = useMatchRoute();
	const { isAuthenticated } = useConvexAuth();
	const sessions = useQuery(api.sessions.list, isAuthenticated ? {} : "skip");

	return (
		<Sidebar>
			<SidebarHeader className="flex-row items-center justify-between px-3 py-2">
				<Logo className="h-5 w-auto text-sidebar-foreground" />
				<SidebarTrigger aria-label="Close sidebar" />
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									isActive={Boolean(matchRoute({ to: "/new" }))}
									onClick={beginNewChat}
									render={<Link to="/new" />}
								>
									<span className="grid  shrink-0 place-items-center rounded bg-muted-foreground/15 p-0.5 text-muted-foreground">
										<Plus className="size-2" />
									</span>
									<span>New session</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<Show when="signed-in">
					<SidebarGroup>
						<SidebarGroupLabel>Recent sessions</SidebarGroupLabel>
						<SidebarGroupContent>
							{sessions === undefined ? (
								<SidebarMenu>
									{Array.from({ length: 8 }, (_, index) => (
										<SidebarMenuItem key={`chat-skeleton-${index}`}>
											<div className="flex h-8 items-center rounded-md px-2">
												<Skeleton
													className={`h-4 ${index % 2 === 0 ? "w-3/5" : "w-2/5"}`}
												/>
											</div>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							) : (
								groupSessionsByRecency(sessions).map((group) => (
									<div key={group.label}>
										<div className="px-2 pt-3 pb-1 font-medium text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
											{group.label}
										</div>
										<SidebarMenu>
											{group.sessions.map((session) => (
												<SidebarMenuItem key={session._id}>
													<SidebarMenuButton
														className="h-auto min-h-8"
									isActive={Boolean(
										matchRoute({
											params: { chatId: session.chatId },
											to: "/c/$chatId",
										})
									)}
														render={
															<Link
																	params={{ chatId: session.chatId }}
																	to="/c/$chatId"
																/>
														}
														tooltip={session.title}
													>
														<span className="min-w-0 flex-1 truncate text-left">
											{session.title || "New session"}
														</span>
													</SidebarMenuButton>
												</SidebarMenuItem>
											))}
										</SidebarMenu>
									</div>
								))
							)}
						</SidebarGroupContent>
					</SidebarGroup>
				</Show>

				<Show when="signed-out">
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={<Link params={{ _splat: "" }} to="/login/$" />}
									>
										<span>Log in</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										render={<Link params={{ _splat: "" }} to="/register/$" />}
									>
										<span>Register</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</Show>
			</SidebarContent>

			<SidebarFooter>
				<div className="flex min-h-10 items-center px-2 py-1">
					<Show when="signed-in">
						<UserButton />
					</Show>
					<Show when="signed-out">
						<span className="px-2 text-sidebar-foreground/60 text-xs">
							Welcome to Phixr
						</span>
					</Show>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}

function groupSessionsByRecency<T extends { updatedAt: number }>(sessions: T[]) {
	const today = new Date();
	const todayIndex = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
	const groups = new Map<string, T[]>();

	for (const session of sessions) {
		const updatedAt = new Date(session.updatedAt);
		const updatedIndex = Date.UTC(
			updatedAt.getFullYear(),
			updatedAt.getMonth(),
			updatedAt.getDate()
		);
		const daysAgo = Math.floor((todayIndex - updatedIndex) / 86_400_000);
		const label =
			daysAgo <= 0
				? "Today"
				: daysAgo === 1
					? "Yesterday"
					: daysAgo <= 7
						? "Last 7 days"
						: "Older";
		groups.set(label, [...(groups.get(label) ?? []), session]);
	}

	return ["Today", "Yesterday", "Last 7 days", "Older"].flatMap((label) => {
		const groupedSessions = groups.get(label);
		return groupedSessions ? [{ label, sessions: groupedSessions }] : [];
	});
}
