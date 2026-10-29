"use client";

import { type CSSProperties, type ReactNode, useMemo, useRef } from "react";
import { motion, type UseInViewOptions, useInView } from "motion/react";
import { cn } from "#/lib/utils.ts";

interface ShimmeringTextProps {
	/** Text to display with shimmer effect */
	text: string;
	/** Animation duration in seconds */
	duration?: number;
	/** Delay before starting animation */
	delay?: number;
	/** Whether to repeat the animation */
	repeat?: boolean;
	/** Pause duration between repeats in seconds */
	repeatDelay?: number;
	/** Custom className */
	className?: string;
	/** Whether to start animation when component enters viewport */
	startOnView?: boolean;
	/** Whether to animate only once */
	once?: boolean;
	/** Margin for in-view detection (rootMargin) */
	inViewMargin?: UseInViewOptions["margin"];
	/** Shimmer spread multiplier */
	spread?: number;
	/** Base text color */
	color?: string;
	/** Shimmer gradient color */
	shimmerColor?: string;
}

export function ShimmeringText({
	text,
	// 1.1s sweep + 0.3s pause = 1.4s cycle.
	duration = 1.1,
	delay = 0,
	repeat = true,
	repeatDelay = 0.3,
	className,
	startOnView = true,
	once = false,
	inViewMargin,
	spread = 2,
	color,
	shimmerColor,
}: ShimmeringTextProps) {
	const ref = useRef<HTMLSpanElement>(null);
	const isInView = useInView(ref, { once, margin: inViewMargin });

	// Calculate dynamic spread based on text length
	const dynamicSpread = useMemo(() => {
		return text.length * spread;
	}, [text, spread]);

	// Determine if we should start animation
	const shouldAnimate = !startOnView || isInView;

	return (
		<motion.span
			animate={
				shouldAnimate
					? {
							backgroundPosition: "0% center",
							opacity: 1,
						}
					: {}
			}
			className={cn(
				"relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
				"[--base-color:var(--muted-foreground)] [--shimmer-color:var(--foreground)]",
				"[background-repeat:no-repeat,padding-box]",
				"[--shimmer-bg:linear-gradient(90deg,transparent_calc(50%-var(--spread)),var(--shimmer-color),transparent_calc(50%+var(--spread)))]",
				"dark:[--base-color:var(--muted-foreground)] dark:[--shimmer-color:var(--foreground)]",
				className,
			)}
			initial={{
				backgroundPosition: "100% center",
				opacity: 0,
			}}
			ref={ref}
			style={
				{
					"--spread": `${dynamicSpread}px`,
					...(color && { "--base-color": color }),
					...(shimmerColor && { "--shimmer-color": shimmerColor }),
					backgroundImage:
						"var(--shimmer-bg), linear-gradient(var(--base-color), var(--base-color))",
				} as CSSProperties
			}
			transition={{
				backgroundPosition: {
					repeat: repeat ? Number.POSITIVE_INFINITY : 0,
					duration,
					delay,
					repeatDelay,
					ease: "linear",
				},
				opacity: {
					duration: 0.3,
					delay,
				},
			}}
		>
			{text}
		</motion.span>
	);
}

interface ShimmerTextProps {
	children: ReactNode;
	className?: string;
	/** Seconds per sweep. Default 1.1. */
	duration?: number;
	/** Seconds before the first sweep. Default 0. */
	delay?: number;
	/** Shimmer spread multiplier. Default 2. */
	spread?: number;
	color?: string;
	shimmerColor?: string;
}

/**
 * Back-compat wrapper for existing call sites:
 * `<ShimmerText>Some status…</ShimmerText>` → `<ShimmeringText text="…" />`.
 * Non-string children can't be measured for spread, so they render plain.
 */
export function ShimmerText({
	children,
	className,
	duration,
	delay,
	spread,
	color,
	shimmerColor,
}: ShimmerTextProps) {
	if (typeof children !== "string" && typeof children !== "number") {
		return <span className={className}>{children}</span>;
	}
	return (
		<ShimmeringText
			className={className}
			color={color}
			delay={delay}
			duration={duration}
			shimmerColor={shimmerColor}
			spread={spread}
			text={String(children)}
		/>
	);
}

export default ShimmerText;
