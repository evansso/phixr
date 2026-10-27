import { verifyToken } from "@clerk/backend";
import { Bucket, uniquePath, uploadHandler } from "@upstash/blob";

export function getBlobBucket() {
	return Bucket.fromEnv();
}

export async function requireUploadUser(request: Request) {
	const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
	if (!token || !process.env.CLERK_SECRET_KEY) throw new Error("Unauthenticated");
	const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
	if (typeof claims.sub !== "string") throw new Error("Unauthenticated");
	return claims.sub;
}

export function getImageUploads() {
	return uploadHandler({
	bucket: getBlobBucket(),
	constraints: { contentTypes: ["image/*"], maxSize: "5mb" },
	context: requireUploadUser,
	onBeforeUpload: ({ ctx, file }) => ({
		path: uniquePath(`users/${ctx}/chat/${file.name}`),
		state: { filename: file.name, size: file.size, contentType: file.type },
	}),
	onUploadComplete: ({ state, url, path }) => ({
		url,
		path,
		filename: state.filename,
		size: state.size,
		contentType: state.contentType,
	}),
});
}
