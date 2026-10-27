import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/dg-token")({
	server: {
		handlers: {
			POST: async () => {
				const apiKey = process.env.DEEPGRAM_API_KEY;
				if (!apiKey) {
					return Response.json({ error: "Deepgram is not configured" }, { status: 503 });
				}
				try {
					const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
						method: "POST",
						headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
						body: JSON.stringify({ ttl_seconds: 60 }),
					});
					if (!response.ok) return Response.json({ error: "Unable to create a Deepgram token" }, { status: 502 });
					const data = await response.json() as { access_token?: string };
					if (!data.access_token) return Response.json({ error: "Deepgram returned no token" }, { status: 502 });
					return Response.json({ token: data.access_token }, { headers: { "Cache-Control": "no-store" } });
				} catch {
					return Response.json({ error: "Unable to reach Deepgram" }, { status: 502 });
				}
			},
		},
	},
});
