import { createBaseten } from "@ai-sdk/baseten";
import { createOpenResponses } from "@ai-sdk/open-responses";

const baseten = createBaseten({
	apiKey: process.env.BASETEN_API_KEY,
});

const meta = createOpenResponses({
	name: "meta",
	url: "https://api.meta.ai/v1/responses",
	apiKey: process.env.MUSE_META_API_KEY,
});

// Dev uses Meta's Responses API directly; everywhere else uses Baseten.
export const museModel =
	process.env.NODE_ENV === "development"
		? meta("muse-wonder-1.0")
		: baseten("meta-models/muse-spark-open-1026");
