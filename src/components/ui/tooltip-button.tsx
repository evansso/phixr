import type React from "react";
import { Button, type ButtonProps } from "#/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "#/components/ui/tooltip";

type TooltipButtonProps = Omit<ButtonProps, "children" | "render"> & {
	children: React.ReactNode;
	tooltip: React.ReactNode;
	tooltipSide?: "top" | "bottom" | "left" | "right";
};

export function TooltipButton({
	children,
	tooltip,
	tooltipSide = "top",
	...buttonProps
}: TooltipButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					(<Button {...buttonProps}>{children}</Button>) as React.ReactElement<
						Record<string, unknown>
					>
				}
				delay={0}
			/>
			<TooltipPopup side={tooltipSide}>{tooltip}</TooltipPopup>
		</Tooltip>
	);
}
