import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, House, RotateCcw } from "lucide-react";
import { Logo } from "#/components/logo";
import { Button, buttonVariants } from "#/components/ui/button";
import { cn } from "#/lib/utils";

type ErrorLayoutProps = {
	code: string;
	description: string;
	title: string;
	children: React.ReactNode;
	detail?: string;
};

function ErrorLayout({ children, code, description, detail, title }: ErrorLayoutProps) {
	return (
		<main className="relative flex min-h-svh flex-col bg-background px-4 py-6 text-foreground sm:px-6">
			<header className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-center">
				<Link aria-label="Phixr home" to="/">
					<Logo className="h-6 w-auto text-foreground" />
				</Link>
			</header>

			<div className="flex flex-1 items-center justify-center py-10">
				<div className="flex w-full max-w-md flex-col items-center text-center">
					<p className="font-heading font-medium text-6xl text-primary tracking-tight sm:text-7xl">
						{code}
					</p>
					<h1 className="mt-4 font-heading font-medium text-3xl tracking-tight text-balance sm:text-4xl">
						{title}
					</h1>
					<p className="mt-3 text-muted-foreground text-sm leading-relaxed text-balance sm:text-base">
						{description}
					</p>

					{detail ? (
						<p className="mt-6 w-full break-words rounded-lg bg-muted px-3 py-2 font-mono text-muted-foreground text-xs leading-relaxed">
							{detail}
						</p>
					) : null}

					<div className="mt-8 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
						{children}
					</div>
				</div>
			</div>
		</main>
	);
}

function BackButton() {
	const router = useRouter();

	return (
		<Button
			className="w-full sm:w-auto"
			onClick={() => {
				if (window.history.length > 1) {
					router.history.back();
				} else {
					router.navigate({ to: "/" });
				}
			}}
			size="lg"
			type="button"
			variant="outline"
		>
			<ArrowLeft data-icon="inline-start" />
			Go back
		</Button>
	);
}

export function NotFoundPage() {
	return (
		<ErrorLayout
			code="404"
			description="The page you're looking for doesn't exist or may have been moved."
			title="Page not found"
		>
			<Link className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")} to="/">
				<House data-icon="inline-start" />
				Go home
			</Link>
			<BackButton />
		</ErrorLayout>
	);
}

export function ErrorPage({
	error,
	reset,
}: {
	error: unknown;
	reset?: () => void;
}) {
	const detail =
		import.meta.env.DEV && error instanceof Error ? error.message : undefined;

	return (
		<ErrorLayout
			code="500"
			description="We hit an unexpected error. Try again, or head back home if it keeps happening."
			detail={detail}
			title="Something went wrong"
		>
			{reset ? (
				<Button className="w-full sm:w-auto" onClick={reset} size="lg" type="button">
					<RotateCcw data-icon="inline-start" />
					Try again
				</Button>
			) : null}
			<Link
				className={cn(
					buttonVariants({ size: "lg", variant: reset ? "outline" : "default" }),
					"w-full sm:w-auto"
				)}
				to="/"
			>
				<House data-icon="inline-start" />
				Go home
			</Link>
		</ErrorLayout>
	);
}
