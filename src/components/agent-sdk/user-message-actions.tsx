import { CheckIcon, CopyIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { TooltipButton } from "#/components/ui/tooltip-button";
import { MessageTime } from "./message-time";

export function UserMessageActions({
	text,
	createdAt,
	disabled = false,
	onEdit,
}: {
	text: string;
	createdAt?: Date;
	disabled?: boolean;
	onEdit?: () => void;
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
		<div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
			{createdAt ? <MessageTime createdAt={createdAt} /> : null}
			<TooltipButton
				aria-label={copied ? "Copied" : "Copy"}
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
			{onEdit ? <TooltipButton
				aria-label="Edit"
				className="size-6 [&_svg]:size-3"
				disabled={disabled}
				onClick={onEdit}
				size="icon-xs"
				tooltip="Edit"
				variant="ghost"
			>
				<PencilIcon className="size-3" />
			</TooltipButton> : null}
		</div>
	);
}
