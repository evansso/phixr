import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getBlobBucket, requireUploadUser } from "#/lib/blob-upload";

const bodySchema = z.object({ path: z.string().min(1).max(1024) });

export const Route = createFileRoute("/api/upload/delete")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				let userId: string;
				try {
					userId = await requireUploadUser(request);
				} catch {
					return Response.json({ error: "Unauthenticated" }, { status: 401 });
				}
				const body = bodySchema.safeParse(await request.json().catch(() => null));
				if (!body.success || !body.data.path.startsWith(`users/${userId}/chat/`)) {
					return Response.json({ error: "Invalid image path" }, { status: 400 });
				}
				try {
					await getBlobBucket().del(body.data.path);
					return Response.json({ deleted: true });
				} catch {
					return Response.json({ error: "Unable to delete image" }, { status: 500 });
				}
			},
		},
	},
});
