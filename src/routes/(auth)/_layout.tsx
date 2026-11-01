import { Logo } from "@/components/logo";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getIsSignedIn = createServerFn({ method: "GET" }).handler(async () => {
	const { auth } = await import("@clerk/tanstack-react-start/server");
	const { userId } = await auth();
	return Boolean(userId);
});

export const Route = createFileRoute("/(auth)/_layout")({
	beforeLoad: async () => {
		if (await getIsSignedIn()) {
			throw redirect({ replace: true, to: "/new" });
		}
	},
	component: AuthLayout,
});

function AuthLayout() {
	return (
		<div className="relative flex min-h-svh flex-col">
			<div className="fixed top-0 left-1/2 -translate-x-1/2 px-4 pt-5">
				<Logo className="h-6 w-auto text-foreground" />
			</div>
			<main className="flex w-full flex-1 items-center justify-center px-4">
				<Outlet />
			</main>
		</div>
	);
}
