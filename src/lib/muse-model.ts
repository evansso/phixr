import { createOpenResponses } from "@ai-sdk/open-responses";

const meta = createOpenResponses({
	name: "meta",
	url: "https://api.meta.ai/v1/responses",
	apiKey: process.env.MUSE_META_API_KEY,
});

export const museModel = meta("muse-wonder-1.0");
