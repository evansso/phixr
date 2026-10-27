import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/_layout")({
	component: AuthLayout,
});

function AuthLayout() {
	return (
		<div className="relative flex min-h-svh flex-col">
			<div className="fixed top-0 left-1/2 -translate-x-1/2 px-4 pt-5 font-medium text-2xl">
				phixir
			</div>
			<main className="flex w-full flex-1 items-center justify-center px-4">
				<Outlet />
			</main>
		</div>
	);
}
