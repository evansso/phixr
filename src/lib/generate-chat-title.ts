import { generateText, Output } from "ai";
import { z } from "zod";

const MAX_TITLE_LENGTH = 80;

export async function generateChatTitle(message: string): Promise<string> {
	const trimmedMessage = message.trim();
	const fallbackTitle = trimmedMessage.slice(0, MAX_TITLE_LENGTH) || "New chat";
	if (!trimmedMessage) {
		return fallbackTitle;
	}

	try {
		const { output } = await generateText({
			model: "openai/gpt-4o-mini",

			maxOutputTokens: 80,
			output: Output.object({
				schema: z.object({ title: z.string().min(2).max(MAX_TITLE_LENGTH) }),
			}),
			system:
				`Create a short sidebar title for a Phixr troubleshooting chat. Name the user's problem or the thing they want to fix, using the most useful product or error detail when available. Keep it natural and easy to scan, usually 3 to 7 words. Do not summarize the whole story, include a proposed fix, or claim the problem is solved. For greetings or messages with no clear issue, use "Getting Started".

Good: "ThinkPad Wi-Fi drops after sleep"
Not: "Help with my laptop"

Good: "Printer shows offline"
Not: "Troubleshooting printer connectivity issues"

Good: "Fix Python import error"
Not: "How to fix the Python import error by reinstalling the package"

Good: "Phone battery drains overnight"
Not: "Battery problem"

Return only the title, without quotes, emojis, or ending punctuation.`,
			prompt: trimmedMessage.slice(0, 300),
		});
		return output.title.trim().slice(0, MAX_TITLE_LENGTH) || fallbackTitle;
	} catch (error) {
		console.warn(
			"Chat title generation failed; using the first message",
			error
		);
		return fallbackTitle;
	}
}
