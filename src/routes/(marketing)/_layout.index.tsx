import { Waitlist } from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/(marketing)/_layout/")({
	head: () => ({
		meta: [
			{ title: "Phixr: Less guessing. More fixing." },
			{
				name: "description",
				content:
					"Tell Phixr what's going wrong. It helps you understand the problem and guides you through fixing it, one step at a time.",
			},
		],
	}),
	component: HomePage,
});

const steps = [
	{
		title: "Tell it what's wrong",
		description: "In your own words. Add a photo of the error if you have one.",
	},
	{
		title: "Answer a few questions",
		description: "Phixr asks what it needs to understand the problem.",
	},
	{
		title: "Follow the next step",
		description: "One clear step at a time, adapting as you go.",
	},
];

function HomePage() {
	return (
		<div className="mx-auto grid w-full max-w-[1440px] flex-1 items-center gap-14 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-10 lg:px-12 lg:py-6 xl:px-16">
			<section className="max-w-2xl">
				<h1 className="font-heading text-5xl leading-[1.02] font-medium tracking-tight text-balance sm:text-6xl xl:text-7xl">
					Less guessing.
					<br />
					More fixing.
				</h1>
				<p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
					Tell Phixr what's going wrong. It helps you understand the problem
					and guides you through what to do next, one step at a time.
				</p>

				<ol className="mt-10 grid gap-6 sm:grid-cols-3 sm:gap-4">
					{steps.map((step, index) => (
						<li key={step.title}>
							<span className="font-heading text-sm text-muted-foreground">
								{String(index + 1).padStart(2, "0")}
							</span>
							<h2 className="mt-2 text-sm font-medium">{step.title}</h2>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
								{step.description}
							</p>
						</li>
					))}
				</ol>

				<Link
					className="group mt-10 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
					to="/why"
				>
					Why I'm building Phixr
					<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
				</Link>
			</section>

			<section
				className="w-full max-w-md scroll-mt-24 justify-self-center lg:justify-self-end"
				id="waitlist"
			>
				<h2 className="font-heading text-2xl font-medium tracking-tight">
					Join the waitlist
				</h2>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					Phixr is still being built. Join the waitlist to be among the first
					to try it when it's ready.
				</p>
				<div className="mt-6">
					<Waitlist />
				</div>
				<p className="mt-4 text-xs text-muted-foreground">
					No tech expertise needed. No spam, just one email when we launch.
				</p>
			</section>
		</div>
	);
}
