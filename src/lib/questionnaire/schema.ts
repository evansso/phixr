import { z } from "zod";

const option = z.object({ id: z.string().min(1).max(40), label: z.string().min(1).max(80) });
const base = {
	id: z.string().min(1).max(40),
	prompt: z.string().min(1).max(200),
	hint: z.string().max(140).optional().describe("One line on where to find the answer, for example: Settings, then About."),
	required: z.boolean().optional(),
};

export const questionSchema = z.discriminatedUnion("type", [
	z.object({ ...base, type: z.literal("single_choice"), options: z.array(option).min(2).max(6), allowOther: z.boolean().optional() }),
	z.object({ ...base, type: z.literal("multi_choice"), options: z.array(option).min(2).max(6), allowOther: z.boolean().optional() }),
	z.object({ ...base, type: z.literal("yes_no") }),
	z.object({ ...base, type: z.literal("text"), placeholder: z.string().max(100).optional() }),
]);

export const questionnaireInput = z.object({ title: z.string().max(80).optional(), intro: z.string().max(400).optional().describe("Optional research summary if it has not already been explained in streamed text. Do not repeat that update. No questions."), questions: z.array(questionSchema).min(1).max(4) }).superRefine((value, ctx) => {
	const ids = value.questions.map((question) => question.id);
	if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Question ids must be unique" });
	for (const question of value.questions) {
		if (question.type === "single_choice" || question.type === "multi_choice") {
			const optionIds = question.options.map((option) => option.id);
			if (new Set(optionIds).size !== optionIds.length) ctx.addIssue({ code: "custom", message: `Option ids must be unique for ${question.id}` });
		}
	}
});
export const answerSchema = z.object({ questionId: z.string(), skipped: z.boolean(), selected: z.array(z.string()).optional(), otherText: z.string().max(500).optional(), text: z.string().max(2000).optional(), yes: z.boolean().optional() });
export const toolOutput = z.discriminatedUnion("status", [
	z.object({ status: z.literal("submitted"), questionnaireId: z.string(), answers: z.array(z.object({ questionId: z.string(), prompt: z.string(), type: z.enum(["single_choice", "multi_choice", "yes_no", "text"]), answer: z.union([z.string(), z.array(z.string()), z.boolean(), z.null()]), other: z.string().optional() })) }),
	z.object({ status: z.literal("skipped"), reason: z.enum(["user_skipped", "user_sent_new_message"]) }),
]);
export type Questionnaire = z.infer<typeof questionnaireInput>;
export type Question = z.infer<typeof questionSchema>;
export type AnswerInput = z.infer<typeof answerSchema>;
export type ToolOutput = z.infer<typeof toolOutput>;
export type PersistedAnswerMessage = {
	id: string;
	text: string;
	metadata: {
		createdAt: string;
		questionnaireTurn: {
			toolCallId: string;
			status: "submitted" | "skipped";
			title?: string;
			answers?: Extract<ToolOutput, { status: "submitted" }>["answers"];
		};
	};
};
