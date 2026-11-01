import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/(marketing)/_layout/why")({
	head: () => ({
		meta: [
			{ title: "Why Phixr | Phixr" },
			{
				name: "description",
				content:
					"I'm Evans. I was the person my family called when their tech stopped working. Then I hit a problem I couldn't fix. That's why I'm building Phixr.",
			},
		],
	}),
	component: WhyPage,
});

function WhyPage() {
	return (
		<article className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
			<h1 className="font-heading text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl">
				Why I'm building Phixr
			</h1>
			<p className="mt-6 text-lg leading-relaxed text-muted-foreground">
				Hi, I'm Evans. I'm a software engineer, and I'm also studying at
				Zetech University, building on what I already know. But before any of
				that, I was just the person my family called when their tech stopped
				working.
			</p>

			<div className="mt-12 space-y-12 leading-relaxed">
				<section>
					<h2 className="font-heading text-2xl font-medium tracking-tight">
						The person everyone calls
					</h2>
					<div className="mt-4 space-y-4 text-muted-foreground">
						<p>
							I've always been good at fixing computer and tech stuff, and somehow
							I can usually figure out what's wrong. So my aunts would call me:
							"Could you help us install this?" "This TV isn't working." "How do
							I set up this Fire TV stick?"
						</p>
						<p>
							I didn't mind. I liked being able to help. But it also showed me
							something: for most people, a tech problem isn't really about the
							technology. It's that they don't know where to start, and they
							don't have someone patient to walk through it with them.
						</p>
					</div>
				</section>

				<section>
					<h2 className="font-heading text-2xl font-medium tracking-tight">
						Then it was my turn
					</h2>
					<div className="mt-4 space-y-4 text-muted-foreground">
						<p>
							Then my own laptop ran into a storage error, and I didn't know how
							to fix it.
						</p>
						<p>
							I went to an AI website, described the error, and asked how to fix
							it. It did help me understand what the error was. But then it gave
							me too many possible fixes, all mixed together. There was no
							structured plan. Nothing that said:{" "}
							<em className="text-foreground">
								check this first, here's how you do it, then we'll see what
								happens next.
							</em>
						</p>
						<p>
							If that felt confusing to me, someone who fixes this stuff for
							other people, I could only imagine how it feels for my aunts.
						</p>
					</div>
				</section>

				<section>
					<h2 className="font-heading text-2xl font-medium tracking-tight">
						What if there was a thing for that?
					</h2>
					<div className="mt-4 space-y-4 text-muted-foreground">
						<p>That's when I started asking myself:</p>
						<blockquote className="border-l-2 border-foreground pl-5 font-heading text-xl leading-snug text-foreground">
							What if you could tell something what you want to fix, even add a
							picture of what's on your screen, and it would understand you, ask
							you the right questions, look into the problem, and then guide you
							through fixing or diagnosing it, step by step?
						</blockquote>
						<p>That's Phixr.</p>
						<p>
							I'm not trying to claim it can magically fix any tech problem. I'm
							building it to help people work through technical problems with
							less confusion and more confidence, the way I try to when someone
							in my family calls me.
						</p>
					</div>
				</section>
			</div>

			<section className="mt-16 border-t pt-10">
				<h2 className="font-heading text-2xl font-medium tracking-tight">
					Be there when it launches
				</h2>
				<p className="mt-3 leading-relaxed text-muted-foreground">
					Phixr is still being built. Join the waitlist and you'll be among the
					first to try it.
				</p>
				<Link
					className="group mt-6 inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
					hash="waitlist"
					to="/"
				>
					Join the waitlist
					<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
				</Link>
				<p className="mt-14 text-sm text-muted-foreground">Evans</p>
			</section>
		</article>
	);
}
