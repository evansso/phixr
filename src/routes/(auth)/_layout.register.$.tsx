import { SignUp } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/_layout/register/$")({
	component: Page,
	head: () => ({
		meta: [
			{ title: "Register - phixr" },
			{ name: "description", content: "Create a new phixr account" },
		],
	}),
});

function Page() {
	return <SignUp />;
}
