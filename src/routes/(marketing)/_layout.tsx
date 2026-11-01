import { useAuth } from "@clerk/tanstack-react-start";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/(marketing)/_layout")({
	component: MarketingLayout,
});

function MarketingLayout() {
	const { isSignedIn } = useAuth();
	return (
		<div className="flex min-h-svh flex-col bg-background text-foreground">
			<header className="mx-auto flex h-16 w-full max-w-[1440px] shrink-0 items-center justify-between px-5 sm:px-8 lg:px-12 xl:px-16">
				<Link aria-label="Phixr home" to="/">
					<Logo className="h-6 w-auto text-foreground" />
				</Link>
				<nav className="flex items-center gap-1 text-sm sm:gap-2">
					<Link
						activeProps={{ className: "text-foreground" }}
						className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
						to="/why"
					>
						Why Phixr
					</Link>
					{isSignedIn ? (
						<Link
							className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background transition-opacity hover:opacity-80"
							to="/new"
						>
							Dashboard
						</Link>
					) : (
						<>
							<Link
								className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
								params={{ _splat: "" }}
								to="/login/$"
							>
								Sign in
							</Link>
							<Link
								className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background transition-opacity hover:opacity-80"
								hash="waitlist"
								to="/"
							>
								Join the waitlist
							</Link>
						</>
					)}
				</nav>
			</header>
			<main className="flex min-h-0 flex-1 flex-col">
				<Outlet />
			</main>
		</div>
	);
}
