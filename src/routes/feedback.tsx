import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/feedback")({
	beforeLoad: () => {
		throw redirect({ href: "https://phixr.userjot.com" });
	},
});
