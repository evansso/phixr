import type { AnswerInput, Questionnaire, ToolOutput } from "./schema";

type Submitted = Extract<ToolOutput, { status: "submitted" }>;

export function formatQuestionnaireAnswers(output: Submitted) {
	return [
		"These are my answers to the questions you asked:",
		...output.answers.map((answer) => {
			const value = answer.answer === null
				? "Skipped"
				: typeof answer.answer === "boolean"
					? answer.answer ? "Yes" : "No"
					: Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer;
			return `${answer.prompt}\n${value}${answer.other ? `: ${answer.other}` : ""}`;
		}),
	].join("\n\n");
}

export function formatQuestionnaireSkipped() {
	return "I skipped the questions.";
}

export function questionnaireAnswerMessageId(toolCallId: string) {
	return `questionnaire-answer-${toolCallId}`;
}

export function buildResult(id: string, q: Questionnaire, answers: AnswerInput[]): Submitted {
	const byId = new Map(answers.map((answer) => [answer.questionId, answer]));
	if (byId.size !== answers.length || answers.some((answer) => !q.questions.some((question) => question.id === answer.questionId))) throw new Error("Unknown or duplicate question answer");
	const questionIds = q.questions.map((question) => question.id);
	if (new Set(questionIds).size !== questionIds.length) throw new Error("Question ids must be unique");
	const out: Submitted["answers"] = [];
	for (const question of q.questions) {
		const a = byId.get(question.id);
		const base = { questionId: question.id, prompt: question.prompt };
		if (!a || a.skipped) {
			if (question.required !== false) throw new Error(`Missing required answer: ${question.id}`);
			out.push({ ...base, type: question.type, answer: null });
			continue;
		}
		switch (question.type) {
			case "yes_no":
				if (a.otherText?.trim()) {
					out.push({ ...base, type: "yes_no", answer: a.otherText.trim() });
					break;
				}
				if (typeof a.yes !== "boolean") throw new Error(`Invalid answer: ${question.id}`);
				out.push({ ...base, type: "yes_no", answer: a.yes });
				break;
			case "text": {
				const text = a.text?.trim();
				if (!text) throw new Error(`Empty text answer: ${question.id}`);
				out.push({ ...base, type: "text", answer: text });
				break;
			}
			case "single_choice":
			case "multi_choice": {
				const selected = a.selected ?? [];
				if (new Set(selected).size !== selected.length) throw new Error(`Duplicate selection: ${question.id}`);
				const labels = selected.map((optionId) => {
					const option = question.options.find((item) => item.id === optionId);
					if (!option) throw new Error(`Unknown option ${optionId} for ${question.id}`);
					return option.label;
				});
				const other = a.otherText?.trim();
				if (other) labels.push("Other");
				if (!labels.length || (question.type === "single_choice" && labels.length !== 1)) throw new Error(`Invalid selection: ${question.id}`);
				out.push({ ...base, type: question.type, answer: question.type === "single_choice" ? labels[0] : labels, ...(other ? { other } : {}) });
			}
		}
	}
	return { status: "submitted", questionnaireId: id, answers: out };
}
