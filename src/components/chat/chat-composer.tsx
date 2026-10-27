import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ChatComposer({
	onSubmit,
	busy = false,
	streaming = false,
	onStop,
	placeholder = "Message...",
	className,
}: {
	onSubmit: (text: string) => void;
	busy?: boolean;
	streaming?: boolean;
	onStop?: () => void;
	placeholder?: string;
	className?: string;
}) {
	const [input, setInput] = useState("");

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const text = input.trim();
		if (!text || busy) return;
		onSubmit(text);
		setInput("");
	}

	return (
		<form
			className={`relative w-full rounded-xl border border-muted-foreground/20 bg-popover p-2 shadow-sm ${className ?? ""}`}
			onSubmit={submit}
		>
			<Textarea
				aria-label={placeholder}
				className="[&_textarea]:max-h-40 [&_textarea]:min-h-10 [&_textarea]:resize-none [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:px-2 [&_textarea]:py-2 [&_textarea]:shadow-none [&_textarea]:ring-0"
				onChange={(event) => setInput(event.target.value)}
				placeholder={placeholder}
				rows={2}
				unstyled
				value={input}
			/>
			<div className="mt-1 flex justify-end">
				<Button
					aria-label={streaming ? "Stop generating" : "Send message"}
					className="rounded-full"
					disabled={!streaming && (busy || !input.trim())}
					onClick={streaming ? onStop : undefined}
					size="icon-sm"
					type={streaming ? "button" : "submit"}
				>
					{streaming ? (
						<SquareIcon aria-hidden="true" className="size-3.5 fill-current" />
					) : (
						<ArrowUpIcon aria-hidden="true" />
					)}
				</Button>
			</div>
		</form>
	);
}
