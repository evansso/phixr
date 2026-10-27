const MODEL_OUTPUT_LIMIT = 8000;

export function truncatePastedOutput(value: string | undefined): string | undefined {
	if (value === undefined || value.length <= MODEL_OUTPUT_LIMIT) return value;
	const omitted = value.length - MODEL_OUTPUT_LIMIT;
	return `${value.slice(0, 4000)}\n[... ${omitted} characters omitted ...]\n${value.slice(-4000)}`;
}
