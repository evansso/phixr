import { createFileRoute } from "@tanstack/react-router";
import { getImageUploads } from "#/lib/blob-upload";

export const Route = createFileRoute("/api/upload")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try { return await getImageUploads().GET(request); }
				catch { return Response.json({ error: "Image uploads are not configured" }, { status: 503 }); }
			},
			POST: async ({ request }) => {
				try { return await getImageUploads().POST(request); }
				catch { return Response.json({ error: "Image uploads are not configured" }, { status: 503 }); }
			},
		},
	},
});
