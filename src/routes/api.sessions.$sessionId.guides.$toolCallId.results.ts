import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { stepResultSchema } from "#/lib/guide-steps/schema";
import { truncatePastedOutput } from "#/lib/guide-steps/truncate";

function getClient(request: Request) {
	const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
	if (!token) throw new Error("Unauthenticated");
	const url = process.env.VITE_CONVEX_URL;
	if (!url) throw new Error("Persistence is not configured");
	const client = new ConvexHttpClient(url);
	client.setAuth(token);
	return client;
}

function modelResult(row: { stepId: string; outcome: string; pastedOutputFull?: string; note?: string }) {
	return {
		stepId: row.stepId,
		outcome: row.outcome,
		pastedOutput: truncatePastedOutput(row.pastedOutputFull),
		note: row.note,
	};
}

const paramsSchema = z.object({ sessionId: z.string(), toolCallId: z.string().min(1) });

export const Route = createFileRoute("/api/sessions/$sessionId/guides/$toolCallId/results")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const parsed = paramsSchema.safeParse(params);
				if (!parsed.success) return Response.json({ error: "Invalid route parameters" }, { status: 400 });
				try {
					const client = getClient(request);
					const sessionId = await client.query(api.guides.resolveChat, { chatId: parsed.data.sessionId }) as Id<"sessions">;
					const rows = await client.query(api.guides.listResults, { sessionId, toolCallId: parsed.data.toolCallId });
					return Response.json({ results: rows.map(modelResult) });
				} catch (cause) {
					const message = cause instanceof Error ? cause.message : "Unable to load guide results";
					return Response.json({ error: message }, { status: message === "Unauthenticated" ? 401 : 404 });
				}
			},
			POST: async ({ request, params }) => {
				const parsedParams = paramsSchema.safeParse(params);
				if (!parsedParams.success) return Response.json({ error: "Invalid route parameters" }, { status: 400 });
				const parsed = stepResultSchema.safeParse(await request.json().catch(() => null));
				if (!parsed.success || (parsed.data.pastedOutput?.length ?? 0) > 20000) return Response.json({ error: "Invalid step result" }, { status: 400 });
				try {
					const client = getClient(request);
					const row = await client.mutation(api.guides.saveResult, {
						chatId: parsedParams.data.sessionId,
						toolCallId: parsedParams.data.toolCallId,
						stepId: parsed.data.stepId,
						outcome: parsed.data.outcome,
						pastedOutputFull: parsed.data.pastedOutput,
						pastedOutputForModel: truncatePastedOutput(parsed.data.pastedOutput),
						note: parsed.data.note,
					});
					return Response.json({ result: modelResult({ stepId: row.stepId, outcome: row.outcome, pastedOutputFull: row.pastedOutputFull, note: row.note }) });
				} catch (cause) {
					const message = cause instanceof Error ? cause.message : "Unable to save guide result";
					return Response.json({ error: message }, { status: message === "Unauthenticated" ? 401 : 400 });
				}
			},
		},
	},
});
