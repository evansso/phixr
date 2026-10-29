import { Show, UserButton } from "@clerk/tanstack-react-start";
import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useConvexAuth, useMutation as useConvexMutation, useQuery } from "convex/react";
import { Archive, Check, Clock, Plus } from "lucide-react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "@/components/logo";
import { toast } from "#/lib/toast";
import { useChatSession } from "@/components/agent-sdk/chat-session-store";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type SessionListItem = {
	_id: Id<"sessions">;
	chatId: string;
	title: string;
	status: "active" | "resolved" | "archived";
	awaitingUser?: boolean;
	createdAt: number;
	updatedAt: number;
};

function formatSessionDate(timestamp: number): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(timestamp));
}

type SessionStatusInfo = {
	status: "active" | "resolved" | "archived";
	awaitingUser?: boolean;
};

function sessionStatusDisplay({ status, awaitingUser }: SessionStatusInfo): {
	label: string;
	icon: React.ReactNode;
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

function SessionStatusIcon({ status, awaitingUser }: SessionStatusInfo) {
	const { icon } = sessionStatusDisplay({ status, awaitingUser });
	return (
		<span aria-hidden="true" className="grid shrink-0 place-items-center">
			{icon}
		</span>
	);
}

export function AppSidebar() {
	const beginNewChat = useChatSession((state) => state.beginNewChat);
	const matchRoute = useMatchRoute();
	const navigate = useNavigate();
	const { isAuthenticated } = useConvexAuth();
	const sessions = useQuery(api.sessions.list, isAuthenticated ? {} : "skip");
	const removeSession = useConvexMutation(api.sessions.remove);
	const { mutateAsync: deleteSession, isPending: isDeleting } = useMutation({
		mutationFn: (sessionId: SessionListItem["_id"]) =>
			removeSession({ sessionId }),
	});
	const [sessionToDelete, setSessionToDelete] = useState<SessionListItem | null>(null);

	const handleDeleteSession = async () => {
		if (!sessionToDelete || isDeleting) return;
		const isActiveSession = Boolean(
			matchRoute({
				params: { chatId: sessionToDelete.chatId },
				to: "/c/$chatId",
			})
		);
		try {
			await deleteSession(sessionToDelete._id);
		} catch {
			toast.error("Couldn't delete this session", "Please try again.");
			return;
		}
		setSessionToDelete(null);
		toast.success("Session deleted");
		if (isActiveSession) {
			beginNewChat();
			void navigate({ to: "/new" });
		}
	};

	return (
		<Sidebar>
			<SidebarHeader className="flex-row items-center justify-between px-4 py-3">
				<Logo className="h-4 w-auto text-sidebar-foreground" />
				<SidebarTrigger aria-label="Close sidebar" size="icon-xs" />
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
											{group.sessions.map((session) => {
												const title = session.title || "New session";
												const statusLabel = sessionStatusDisplay({
													awaitingUser: session.awaitingUser,
													status: session.status,
												}).label;
												return (
													<SidebarMenuItem key={session._id}>
														<Tooltip>
															<TooltipTrigger
																delay={300}
																render={
																	<SidebarMenuButton
																		className="h-auto min-h-8 group-has-data-[sidebar=menu-action]/menu-item:pr-2!"
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
																	>
																		<SessionStatusIcon
																			awaitingUser={session.awaitingUser}
																			status={session.status}
																		/>
																		<span className="min-w-0 flex-1 truncate text-left text-[13px]">
																			{title}
																		</span>
																	</SidebarMenuButton>
																}
															/>
															<TooltipPopup
																align="start"
																className="rounded-lg bg-popover text-popover-foreground"
																side="right"
																sideOffset={8}
															>
																<span className="flex w-60 flex-col gap-1 px-1 py-1 text-left">
																	<span className="break-words text-xs font-medium leading-snug">
																		{title}
																	</span>
																	<span className="text-[11px] text-muted-foreground">
																		{statusLabel}
																	</span>
																	<span className="text-[11px] text-muted-foreground">
																		{formatSessionDate(session.updatedAt)}
																	</span>
																</span>
															</TooltipPopup>
														</Tooltip>
														<Tooltip>
															<TooltipTrigger
																delay={0}
																render={
																	<SidebarMenuAction
																		aria-label={`Delete ${title}`}
																		className="bg-sidebar-accent"
																		onClick={(event) => {
																			event.preventDefault();
																			event.stopPropagation();
																			setSessionToDelete(session);
																		}}
																		showOnHover
																	>
																		<Archive aria-hidden="true" className="size-3.5!" />
																	</SidebarMenuAction>
																}
															/>
															<TooltipPopup side="top">Archive</TooltipPopup>
														</Tooltip>
													</SidebarMenuItem>
												);
											})}
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

			<Dialog
				onOpenChange={(open) => {
					if (!open && !isDeleting) setSessionToDelete(null);
				}}
				open={sessionToDelete !== null}
			>
				<DialogContent className="w-[min(92vw,28rem)]">
					<DialogHeader>
						<DialogTitle>Delete this session?</DialogTitle>
						<DialogDescription>
							{sessionToDelete
								? `"${sessionToDelete.title || "New session"}" and all of its messages will be permanently deleted. This can't be undone.`
								: "All messages in this chat will be permanently deleted. This can't be undone."}
						</DialogDescription>
					</DialogHeader>
					<div className="flex justify-end gap-2">
						<DialogClose render={<Button variant="outline" />}>
							Cancel
						</DialogClose>
						<Button
							className="bg-destructive text-white hover:bg-destructive/90"
							disabled={isDeleting}
							onClick={() => void handleDeleteSession()}
						>
							{isDeleting ? "Deleting..." : "Delete session"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
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
