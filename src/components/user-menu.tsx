import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
	ChevronsUpDown,
	House,
	LogOut,
	Settings,
	UserRound,
} from "lucide-react";
import {
	type SettingsTab,
	SettingsDialog,
} from "@/components/settings-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export function UserMenu() {
	const { user, isLoaded } = useUser();
	const { signOut } = useClerk();
	const navigate = useNavigate();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");

	const openSettings = (tab: SettingsTab) => {
		setSettingsTab(tab);
		setSettingsOpen(true);
	};

	if (!isLoaded) {
		return (
			<div className="flex items-center gap-2 px-2 py-1.5">
				<Skeleton className="size-6 rounded-full" />
				<Skeleton className="h-4 w-24" />
			</div>
		);
	}
	if (!user) return null;

	const name =
		user.fullName ||
		user.firstName ||
		user.username ||
		user.primaryEmailAddress?.emailAddress ||
		"Account";
	const initials = name.slice(0, 1).toUpperCase();

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<button
							aria-label="Open account menu"
							className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
							type="button"
						>
							{user.imageUrl ? (
								<img
									alt=""
									className="size-6 shrink-0 rounded-full object-cover"
									src={user.imageUrl}
								/>
							) : (
								<span
									aria-hidden="true"
									className="grid size-6 shrink-0 place-items-center rounded-full bg-sidebar-accent font-medium text-sidebar-accent-foreground text-[10px]"
								>
									{initials}
								</span>
							)}
							<span className="block min-w-0 flex-1 truncate font-medium text-sm">
								{name}
							</span>
							<span className="shrink-0 rounded-sm bg-muted-foreground/15 px-2 py-1 font-medium text-[10px] leading-none text-muted-foreground uppercase">
								Beta
							</span>
							<ChevronsUpDown
								aria-hidden="true"
								className="size-4 shrink-0 text-sidebar-foreground/50"
							/>
						</button>
					}
				/>
				<DropdownMenuContent align="start" className="w-(--anchor-width)" side="top" sideOffset={8}>
					<DropdownMenuGroup>
						<DropdownMenuItem className="cursor-pointer" onClick={() => openSettings("account")}>
							<Settings aria-hidden="true" />
							<span>Settings</span>
						</DropdownMenuItem>
						<DropdownMenuItem className="cursor-pointer" onClick={() => openSettings("account")}>
							<UserRound aria-hidden="true" />
							<span>Account</span>
						</DropdownMenuItem>
						<DropdownMenuItem className="cursor-pointer" onClick={() => void navigate({ to: "/" })}>
							<House aria-hidden="true" />
							<span>Homepage</span>
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem
							className="cursor-pointer"
							onClick={() => void signOut({ redirectUrl: "/" })}
							variant="destructive"
						>
							<LogOut aria-hidden="true" />
							<span>Log out</span>
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			<SettingsDialog
				onOpenChange={setSettingsOpen}
				onTabChange={setSettingsTab}
				open={settingsOpen}
				tab={settingsTab}
			/>
		</>
	);
}
