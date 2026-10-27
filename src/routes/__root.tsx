import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start";
import { shadcn } from "@clerk/ui/themes";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import appCss from "../styles.css?url";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
	throw new Error("VITE_CONVEX_URL must be configured to connect to Convex");
}
const convex = new ConvexReactClient(convexUrl);

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
	{
		head: () => ({
			meta: [
				{
					charSet: "utf-8",
				},
				{
					name: "viewport",
					content: "width=device-width, initial-scale=1",
				},
				{
					title: "Phixr",
				},
				{
					property: "og:title",
					content: "Phixr",
				},
				{
					property: "og:image",
					content: "/og.png",
				},
				{
					name: "twitter:card",
					content: "summary_large_image",
				},
				{
					name: "twitter:title",
					content: "Phixr",
				},
				{
					name: "twitter:image",
					content: "/og.png",
				},
			],
			links: [
				{
				rel: "icon",
				href: "/favicon.ico",
			},
				{
					rel: "stylesheet",
					href: appCss,
				},
			],
		}),
		component: RootComponent,
		shellComponent: RootDocument,
	}
);

function RootComponent() {
	return (
		<ClerkProvider
			appearance={{
				theme: shadcn,
			}}
			signInUrl="/login"
			signUpUrl="/register"
		>
			<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
				<TooltipProvider>
					<ToastProvider timeout={2000}>
						<Outlet />
					</ToastProvider>
				</TooltipProvider>
			</ConvexProviderWithClerk>
		</ClerkProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="antialiased">
				{children}
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
