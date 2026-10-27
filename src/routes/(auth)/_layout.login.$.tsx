import { SignIn } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/_layout/login/$")({
	component: Page,
	head: () => ({
		meta: [
			{ title: "Login - phixr" },
			{ name: "description", content: "Login to your phixr account" },
		],
	}),
});

function Page() {
	return <SignIn />;
}
