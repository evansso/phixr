import { tool } from "ai";
import { questionnaireInput, toolOutput } from "./schema";

export const askUserQuestionnaire = tool({
	description: `Present one short questionnaire to collect information only the user can provide and that changes your next step. Never ask for anything Phixr's other tools can find out. Do not repeat information already in this session. Ask all independent unknowns together, up to 4 questions, most diagnostic first. Questions that depend on earlier answers wait for a later questionnaire. Do not ask questions in plain chat. Prefer choices and yes/no over text; use time ranges (today, this week, longer ago) with allowOther for onset questions. Use allowOther when needed. Required means you cannot proceed without it. Answers are user reports to verify, not facts. Do not use after 3 or more questionnaires without new information.`,
	inputSchema: questionnaireInput,
	outputSchema: toolOutput,
});
