import { CheckIcon, CopyIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { TooltipButton } from "#/components/ui/tooltip-button";
import { MessageTime } from "./message-time";

export function AssistantMessageActions({
	text,
	createdAt,
	onRedo,
}: {
	text: string;
	createdAt?: Date;
	onRedo: () => void;
}) {
	const [copied, setCopied] = useState(false);

	async function copyMessage() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div className="flex items-center justify-start gap-1">
			{text ? (
				<TooltipButton
					aria-label={copied ? "Copied" : "Copy message"}
					className="size-6 [&_svg]:size-3"
					onClick={() => void copyMessage()}
					size="icon-xs"
					tooltip={copied ? "Copied" : "Copy"}
					variant="ghost"
				>
					{copied ? (
						<CheckIcon className="size-3" />
					) : (
						<CopyIcon className="size-3" />
					)}
				</TooltipButton>
			) : null}
			<TooltipButton
				aria-label="Retry"
				className="size-6 [&_svg]:size-3"
				onClick={onRedo}
				size="icon-xs"
				tooltip="Retry"
				variant="ghost"
			>
				<RotateCcwIcon className="size-3" />
			</TooltipButton>
			{createdAt ? <MessageTime createdAt={createdAt} /> : null}
		</div>
	);
}
