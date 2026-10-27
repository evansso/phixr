import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { answerSchema, questionnaireInput } from "#/lib/questionnaire/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const bodySchema = z.object({
	toolCallId: z.string().min(1),
	action: z.enum(["submitted", "skipped"]).optional(),
	questionnaire: questionnaireInput.optional(),
	answers: z.array(answerSchema).optional(),
});

export async function submitQuestionnaire(request: Request, sessionKey: string) {
	const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
	if (!token) return Response.json({ error: "Unauthenticated" }, { status: 401 });
	const url = process.env.VITE_CONVEX_URL;
	if (!url) return Response.json({ error: "Persistence is not configured" }, { status: 500 });
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 });
	const client = new ConvexHttpClient(url);
	client.setAuth(token);
	try {
		const sessionId = await client.query(api.questionnaires.resolveChat, { chatId: sessionKey }) as Id<"sessions">;
		const saved = await client.mutation(api.questionnaires.submit, {
			sessionId,
			toolCallId: parsed.data.toolCallId,
			action: parsed.data.action ?? "submitted",
			answers: parsed.data.answers ?? [],
		});
		return Response.json({ ...saved.result, answerMessage: saved.answerMessage });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to save questionnaire";
		return Response.json({ error: message }, { status: message === "Unauthenticated" ? 401 : 400 });
	}
}
