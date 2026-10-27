import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(dash)/_layout/")({
	beforeLoad: () => {
		throw redirect({ to: "/new", replace: true });
	},
});
