import { verifyToken } from "@clerk/backend";
import { defineWebSocketHandler } from "nitro";

const META_ASR_URL = "wss://api.meta.ai/v1/asr/realtime";
const META_MODEL = "muse-voice-transcribe-1.0";
// Browser audio arrives in ~80 ms frames; cap the pre-connect buffer at ~8 s.
const MAX_QUEUED_FRAMES = 100;

type PeerContext = {
	userId: string;
	upstream?: WebSocket;
	// Audio sent before Meta's handshake acknowledgement is discarded by Meta,
	// so frames are buffered until the ack arrives.
	ready?: boolean;
	endStreamQueued?: boolean;
	queue: Array<ArrayBuffer>;
};

function getSessionToken(request: Request) {
	const cookie = request.headers.get("cookie") ?? "";
	for (const part of cookie.split(";")) {
		const [name, ...rest] = part.trim().split("=");
		if (name === "__session") return rest.join("=");
	}
	return null;
}

function relayCloseCode(code: number) {
	// 1000 normal, 1008 bad config/pacing, 1011 retryable, 1013 rate limited.
	return code === 1000 || code === 1008 || code === 1011 || code === 1013 ? code : 1011;
}

export default defineWebSocketHandler({
	async upgrade(request) {
		const token = getSessionToken(request);
		const secretKey = process.env.CLERK_SECRET_KEY;
		if (!token || !secretKey) throw new Response("Unauthorized", { status: 401 });
		try {
			const payload = await verifyToken(token, { secretKey });
			return { context: { userId: payload.sub, queue: [] } satisfies PeerContext };
		} catch {
			throw new Response("Unauthorized", { status: 401 });
		}
	},
	open(peer) {
		const context = peer.context as PeerContext;
		const apiKey = process.env.MUSE_META_API_KEY;
		if (!apiKey) {
			peer.close(1011, "Voice transcription is not configured");
			return;
		}
		const sessionId = `phixr-${peer.id}`;
		const upstream = new WebSocket(`${META_ASR_URL}?sessionId=${encodeURIComponent(sessionId)}`);
		context.upstream = upstream;
		upstream.addEventListener("open", () => {
			upstream.send(
				JSON.stringify({
					authorization: { accessToken: `Bearer ${apiKey}` },
					audioEncoding: "PCM_24KHZ",
					model: META_MODEL,
					mode: "PUSH_TO_TALK",
					partialMode: "CUMULATIVE",
					emitAudioProgress: false,
				}),
			);
		});
		upstream.addEventListener("message", (event) => {
			if (typeof event.data !== "string") return;
			if (!context.ready) {
				// First frame is the handshake acknowledgement ({ sessionId }).
				context.ready = true;
				for (const frame of context.queue) upstream.send(frame);
				context.queue = [];
				if (context.endStreamQueued) upstream.send(JSON.stringify({ type: "endStream" }));
			}
			peer.send(event.data);
		});
		upstream.addEventListener("close", (event) => {
			context.ready = false;
			try {
				peer.close(relayCloseCode(event.code), event.reason || undefined);
			} catch {
				// Peer already gone.
			}
		});
		upstream.addEventListener("error", () => {
			try {
				peer.close(1011, "Voice transcription connection failed");
			} catch {
				// Peer already gone.
			}
		});
	},
	message(peer, message) {
		const context = peer.context as PeerContext;
		const upstream = context.upstream;
		const isBinary = message.data instanceof ArrayBuffer || ArrayBuffer.isView(message.data);
		if (!isBinary) {
			// The only client control frame Meta accepts after the handshake.
			try {
				const parsed = JSON.parse(message.text()) as { type?: string };
				if (parsed.type !== "endStream") return;
			} catch {
				return;
			}
			if (context.ready && upstream?.readyState === WebSocket.OPEN) {
				upstream.send(JSON.stringify({ type: "endStream" }));
			} else {
				context.endStreamQueued = true;
			}
			return;
		}
		const raw = message.uint8Array();
		const frame = new Uint8Array(raw.byteLength);
		frame.set(raw);
		if (context.ready && upstream?.readyState === WebSocket.OPEN) {
			upstream.send(frame);
		} else if (context.queue.length < MAX_QUEUED_FRAMES) {
			context.queue.push(frame.buffer);
		}
	},
	close(peer) {
		const context = peer.context as PeerContext;
		context.queue = [];
		if (context.upstream && context.upstream.readyState < WebSocket.CLOSING) context.upstream.close();
	},
	error(peer) {
		const context = peer.context as PeerContext;
		if (context.upstream && context.upstream.readyState < WebSocket.CLOSING) context.upstream.close();
	},
});
