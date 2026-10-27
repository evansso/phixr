import { createFileRoute } from "@tanstack/react-router";
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	smoothStream,
	stepCountIs,
	streamText,
	registerTelemetry,
	type UIMessage,
} from "ai";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/tanstack-react-start/server";
import { z } from "zod";
import { generateChatTitle } from "#/lib/generate-chat-title";
import { guide_steps } from "#/lib/guide-steps/tool";
import { buildSystemPrompt } from "#/lib/prompt";
import { submitQuestionnaire } from "#/lib/questionnaire/persistence";
import { askUserQuestionnaire } from "#/lib/questionnaire/tool";
import { propose_resolution } from "#/lib/resolution/tool";
import { fetch_page, search_web } from "#/lib/research/tools";
import { skillIndex } from "#/lib/skills/index";
import { load_skill } from "#/lib/skills/tool";
import { museModel } from "#/lib/muse-model";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function getConvexClientAsUser(userId: string, issuer: string) {
	const url = process.env.VITE_CONVEX_URL;
	if (!url) throw new Error("VITE_CONVEX_URL is not configured");
	const deployKey = process.env.CONVEX_DEPLOY_KEY;
	if (!deployKey) throw new Error("CONVEX_DEPLOY_KEY is not configured");
	const client = new ConvexHttpClient(url);
	client.setAdminAuth(deployKey, { subject: userId, issuer });
	return client;
}

const userMessageSchema = z.object({
	id: z.string(),
	role: z.enum(["user", "assistant"]),
	parts: z.array(z.unknown()),
	metadata: z.unknown().optional(),
});

const chatRequestSchema = z.object({
	id: z.string(),
	message: userMessageSchema,
	trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
});

const RESEARCH = ["search_web", "fetch_page"];
const MAX_RESEARCH = 3;

let devToolsRegistration: Promise<void> | undefined;

function registerDevToolsInDevelopment() {
	if (process.env.NODE_ENV !== "development") return Promise.resolve();
	devToolsRegistration ??= import("@ai-sdk/devtools").then(({ DevToolsTelemetry }) => {
		registerTelemetry(DevToolsTelemetry());
	});
	return devToolsRegistration;
}

async function closeDanglingToolCalls(
	messages: UIMessage[],
	client: ConvexHttpClient,
	sessionId: Id<"sessions">
): Promise<UIMessage[]> {
	const completedCalls = new Set(
		messages.flatMap((message) =>
			message.parts.flatMap((part) => {
				const candidate = part as {
					type?: string;
					state?: string;
					toolCallId?: string;
				};
				return (candidate.type === "tool-askUserQuestionnaire" ||
					candidate.type === "tool-guide_steps") &&
					candidate.state === "output-available" &&
					candidate.toolCallId
					? [candidate.toolCallId]
					: [];
			})
		)
	);
	return Promise.all(
		messages.map(async (message) => ({
			...message,
			parts: await Promise.all(
				message.parts.map(async (part) => {
					const candidate = part as {
						type?: string;
						state?: string;
						[key: string]: unknown;
					};
					if (
						candidate.state !== "input-available" ||
						completedCalls.has(String(candidate.toolCallId))
					) {
						return part;
					}
					if (candidate.type === "tool-askUserQuestionnaire") {
						if (typeof candidate.toolCallId === "string") {
							const saved = await client.query(api.questionnaires.findByToolCall, {
								toolCallId: candidate.toolCallId,
						});
							if (saved) {
								return { ...candidate, state: "output-available", output: saved.result };
							}
						}
						return {
							...candidate,
							state: "output-available",
							output: { status: "skipped", reason: "user_sent_new_message" },
						};
					}
					if (candidate.type === "tool-propose_resolution") {
						return {
							...candidate,
							state: "output-available",
							output: { status: "not_sure" },
						};
					}
					if (
						candidate.type === "tool-guide_steps" &&
						typeof candidate.toolCallId === "string"
					) {
						const rows = await client.query(api.guides.listResults, {
							sessionId,
							toolCallId: candidate.toolCallId,
						});
						const results = rows.map((row) => ({
							stepId: row.stepId,
							outcome: row.outcome,
							pastedOutput: row.pastedOutputForModel,
							note: row.note,
						}));
						return {
							...candidate,
							state: "output-available",
							output: { results, stoppedReason: "interrupted" },
						};
					}
					return part;
				})
			),
		}))
	);
}

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const chatId = new URL(request.url).searchParams.get("chatId");
				const { userId, sessionClaims } = await auth();
				if (!userId || typeof sessionClaims?.iss !== "string") {
					return Response.json({ error: "Unauthenticated" }, { status: 401 });
				}
				let client: ConvexHttpClient;
				try {
					client = getConvexClientAsUser(userId, sessionClaims.iss);
				} catch (error) {
					console.error("Failed to configure Convex server auth", error);
					return Response.json(
						{ error: "Convex server auth is not configured" },
						{ status: 500 }
					);
				}
				try {
					if (!chatId) {
						const sessions = await client.query(api.sessions.list, {});
						return Response.json({ sessions });
					}
					const messages = await client.query(api.messages.list, {
						sessionId: chatId as Id<"sessions">,
					});
					const session = await client.query(api.sessions.getTitle, {
						sessionId: chatId as Id<"sessions">,
					});
					return Response.json({
						messages,
						title: session?.title ?? "New chat",
					});
				} catch {
					return Response.json({ error: "Chat not found" }, { status: 404 });
				}
			},
			POST: async ({ request }) => {
				await registerDevToolsInDevelopment();
				let payload: unknown;
				try {
					payload = await request.json();
				} catch {
					return Response.json({ error: "Invalid JSON body" }, { status: 400 });
				}
				if (
					payload &&
					typeof payload === "object" &&
					"intent" in payload &&
					(payload.intent === "submit-questionnaire" || payload.intent === "save-questionnaire")
				) {
					const requestBody = payload as { sessionKey?: unknown };
					if (typeof requestBody.sessionKey !== "string") {
						return Response.json({ error: "Invalid session" }, { status: 400 });
					}
					return submitQuestionnaire(
						new Request(request.url, {
							method: "POST",
							headers: request.headers,
							body: JSON.stringify(payload),
						}),
						requestBody.sessionKey
					);
				}

				const { userId, sessionClaims } = await auth();
				if (!userId || typeof sessionClaims?.iss !== "string") {
					return Response.json({ error: "Unauthenticated" }, { status: 401 });
				}

				let client: ConvexHttpClient;
				try {
					client = getConvexClientAsUser(userId, sessionClaims.iss);
				} catch (error) {
					console.error("Failed to configure Convex server auth", error);
					return Response.json(
						{ error: "Convex server auth is not configured" },
						{ status: 500 }
					);
				}

				const parsed = chatRequestSchema.safeParse(payload);
				if (!parsed.success) {
					return Response.json(
						{ error: "A user message is required" },
						{ status: 400 }
					);
				}
				const chatId = await client.mutation(api.sessions.getOrCreate, {
					chatKey: parsed.data.id,
				});
				let message = parsed.data.message as UIMessage;
				const sessionId = chatId as Id<"sessions">;

				let previousMessages: UIMessage[];
				try {
					previousMessages = await client.query(api.messages.list, {
						sessionId,
					});
				} catch {
					return Response.json({ error: "Chat not found" }, { status: 404 });
				}
				if (message.role === "user" && message.metadata && typeof message.metadata === "object") {
					const turn = (message.metadata as { questionnaireTurn?: { toolCallId?: string } }).questionnaireTurn;
					if (turn?.toolCallId) {
						const canonicalAnswer = previousMessages.find((item) => {
							if (item.role !== "user" || !item.metadata || typeof item.metadata !== "object") return false;
							const savedTurn = (item.metadata as { questionnaireTurn?: { toolCallId?: string } }).questionnaireTurn;
							return savedTurn?.toolCallId === turn.toolCallId;
						});
						if (canonicalAnswer) message = canonicalAnswer;
					}
				}

				const alreadySaved = previousMessages.some(
					(item) => item.id === message.id
				);
				const isFirstMessage = previousMessages.length === 0;
				if (isFirstMessage && message.role !== "user") {
					return Response.json(
						{ error: "A new chat must begin with a user message" },
						{ status: 400 }
					);
				}
				const shouldGenerateTitle = isFirstMessage && message.role === "user";
				const isRegeneration = parsed.data.trigger === "regenerate-message";
				if (!(isRegeneration || alreadySaved)) {
					await client.mutation(api.messages.append, {
						sessionId,
						id: message.id,
						role: message.role,
						parts: message.parts,
						metadata: message.metadata,
					});
				}
				let messages = previousMessages;
				if (isRegeneration) {
					messages = previousMessages.filter((item) => item.id !== message.id);
				} else if (alreadySaved) {
					messages = previousMessages.map((item) =>
						item.id === message.id ? message : item
					);
				} else {
					messages = [...previousMessages, message];
				}
				const closedMessages = await closeDanglingToolCalls(
					messages,
					client,
					sessionId
				);
				for (const after of closedMessages) {
					const stored = previousMessages.find((item) => item.id === after.id);
					if (
						stored &&
						JSON.stringify(stored.parts) !== JSON.stringify(after.parts)
					) {
						await client.mutation(api.questionnaires.closeDangling, {
							sessionId,
							messageId: after.id,
							parts: after.parts,
						});
					}
				}
				messages = closedMessages;
				const modelMessages = await convertToModelMessages(messages);
				if (modelMessages.length === 0) {
					return Response.json({ error: "There are no messages to send to the assistant." }, { status: 400 });
				}
				const questionnaireCount = await client.query(
					api.questionnaires.countForSession,
					{ sessionId }
				);
				const canAskQuestionnaire = questionnaireCount < 4;

				const stream = createUIMessageStream<UIMessage>({
					originalMessages: messages,
					onError: (error) => {
						console.error("Chat UI stream failed", error);
						return "The assistant couldn't finish this response. Please try again.";
					},
					execute: async ({ writer }) => {
						writer.write({ type: "start" });
						if (shouldGenerateTitle) {
							try {
								const firstText = message.parts
									.filter(
										(part): part is { type: "text"; text: string } =>
											part.type === "text" &&
											"text" in part &&
											typeof part.text === "string"
									)
									.map((part) => part.text)
									.join(" ");
								const title = await generateChatTitle(
									firstText 
								);
								await client.mutation(api.sessions.update, { sessionId, title });
								writer.write({
									type: "data-chat-title",
									data: { title },
									transient: true,
								});
							} catch (error) {
								console.error("Failed to update chat title", error);
							}
						}
						const result = streamText({
							model: museModel,
							system: buildSystemPrompt(skillIndex()),
							messages: modelMessages,
							tools: {
								...(canAskQuestionnaire ? { askUserQuestionnaire } : {}),
								guide_steps,
								propose_resolution,
								search_web,
								fetch_page,
								...(load_skill ? { load_skill } : {}),
							},
							experimental_transform: smoothStream({ chunking: "word" }),
							stopWhen: stepCountIs(10),
							onError: ({ error }) => {
								console.error("AI SDK streamText failed", error);
							},
							// No forced first step: the model streams plain text and
							// picks tools itself. Only the per-turn research cap is
							// enforced here, by removing research tools once spent.
							prepareStep: ({ steps }) => {
								const researchCalls = steps
									.flatMap((step) => step.toolCalls)
									.filter((call) => call?.toolName !== undefined && RESEARCH.includes(call.toolName)).length;
								if (researchCalls < MAX_RESEARCH) return {};
								const activeTools = [
									...(canAskQuestionnaire ? ["askUserQuestionnaire"] : []),
									"guide_steps",
									"propose_resolution",
									...(load_skill ? ["load_skill"] : []),
								];
								return { activeTools: activeTools as never[] };
							},
						});
						writer.merge(
							result.toUIMessageStream({
								sendStart: false,
								sendReasoning: false,
							})
						);
					},
					onEnd: async ({ responseMessage }) => {
						try {
							await client.mutation(api.messages.append, {
								sessionId,
								id: responseMessage.id,
								role: responseMessage.role,
								parts: responseMessage.parts,
								metadata: responseMessage.metadata,
							});
						} catch (error) {
							console.error("Failed to save chat message", error);
						}
					},
				});

				return createUIMessageStreamResponse({
					stream,
				});
			},
		},
	},
});
