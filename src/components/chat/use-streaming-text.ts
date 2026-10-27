import { useEffect, useRef, useState } from "react";

const FLUSH_INTERVAL_MS = 50;

/** A word only appears once it is complete, so drop a trailing partial token. */
function dropPartialWord(text: string) {
	return text.replace(/\S+$/, "");
}

/**
 * Returns the text to render right now.
 * - Not streaming: the full text, immediately (history, and the final flush).
 * - Streaming: updates at most once per FLUSH_INTERVAL_MS and never ends on a
 *   partial word. No artificial pacing: new words show up as fast as the
 *   stream delivers them, and the CSS fade does the smoothing.
 */
export function useStreamingText(text: string, isStreaming: boolean): string {
	const [flushed, setFlushed] = useState(text);
	const latestRef = useRef(text);
	const lastFlushRef = useRef(0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	latestRef.current = text;

	useEffect(() => {
		if (!isStreaming) {
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			return;
		}
		if (timerRef.current !== null) return;

		const wait = Math.max(
			0,
			FLUSH_INTERVAL_MS - (performance.now() - lastFlushRef.current)
		);
		timerRef.current = setTimeout(() => {
			timerRef.current = null;
			lastFlushRef.current = performance.now();
			setFlushed(latestRef.current);
		}, wait);
	}, [text, isStreaming]);

	useEffect(
		() => () => {
			if (timerRef.current !== null) clearTimeout(timerRef.current);
		},
		[]
	);

	if (!isStreaming) return text;
	// A replaced reply must not show the old text while the next flush is pending.
	const base = text.startsWith(flushed) ? flushed : "";
	return dropPartialWord(base);
}