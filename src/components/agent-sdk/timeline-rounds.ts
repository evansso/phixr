export type TimelineMessage = {
	id: string;
	role: string;
	metadata?: unknown;
};

export type TimelineRound = {
	/** ID of the first message in the round. Stable across renders. */
	id: string;
	index: number;
	messageIds: string[];
	/** Only the final round is live; all earlier rounds are foldable. */
	isLive: boolean;
};

function isQuestionnaireAnswer(message: TimelineMessage): boolean {
	if (message.role !== "user" || !message.metadata || typeof message.metadata !== "object") {
		return false;
	}
	const turn = (message.metadata as { questionnaireTurn?: { toolCallId?: string } }).questionnaireTurn;
	return typeof turn?.toolCallId === "string" && turn.toolCallId.length > 0;
}

/**
 * A round is one user message plus every assistant message that follows
 * it, up to the next user message. A questionnaire-answers user message
 * closes the round that asked the questions instead of starting a new
 * one, so it is attached to the current round.
 */
export function splitRounds(messages: readonly TimelineMessage[]): TimelineRound[] {
	const rounds: TimelineRound[] = [];
	let current: TimelineRound | null = null;

	for (const message of messages) {
		const startsRound = message.role === "user" && !isQuestionnaireAnswer(message);
		if (startsRound || !current) {
			current = { id: message.id, index: rounds.length, messageIds: [], isLive: false };
			rounds.push(current);
		}
		current.messageIds.push(message.id);
	}

	for (const [index, round] of rounds.entries()) {
		round.index = index;
		round.isLive = index === rounds.length - 1;
	}
	return rounds;
}

export function roundByMessageId(rounds: readonly TimelineRound[]): Map<string, TimelineRound> {
	const map = new Map<string, TimelineRound>();
	for (const round of rounds) {
		for (const id of round.messageIds) {
			map.set(id, round);
		}
	}
	return map;
}
