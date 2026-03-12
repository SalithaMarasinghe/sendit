/**
 * Sendit - Worker Backend
 * Handles API requests, R2 storage, and D1 metadata.
 */

interface Env {
	DB: D1Database;
	BUCKET: R2Bucket;
	AUTH_SECRET: string;
	MAX_UPLOAD_SIZE: string;
	MAX_STORAGE_SIZE: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		let path = url.pathname;
		if (path.startsWith("/api")) {
			path = path.replace("/api", "");
		}
		if (path === "") path = "/";

		// 1. Handle CORS Preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
				},
			});
		}

		// 2. Public Endpoints
		if (path === "/auth/unlock" && request.method === "POST") {
			const { secret } = await request.json() as { secret: string };
			if (secret === env.AUTH_SECRET) {
				return jsonResponse({ success: true });
			}
			return jsonResponse({ error: "Invalid secret" }, 401);
		}

		// 3. Auth Gate for other /api/ endpoints
		const authHeader = request.headers.get("Authorization");
		const secretParam = url.searchParams.get("secret");

		if ((!authHeader || authHeader !== env.AUTH_SECRET) && (!secretParam || secretParam !== env.AUTH_SECRET)) {
			return jsonResponse({ error: "Unauthorized" }, 401);
		}

		try {
			// 4. Router
			if (path === "/items" && request.method === "GET") {
				const folderId = url.searchParams.get("folderId") || null;
				return handleListItems(env, folderId);
			}

			if (path === "/storage/stats" && request.method === "GET") {
				return handleStorageStats(env);
			}

			if (path === "/files/upload" && request.method === "POST") {
				return handleFileUpload(request, env);
			}

			if (path.startsWith("/files/") && request.method === "GET") {
				const id = path.split("/").pop();
				return handleFileDownload(env, id);
			}

			if (path.startsWith("/files/") && request.method === "PATCH") {
				const id = path.split("/").pop();
				return handleFileRename(request, env, id);
			}

			if (path.startsWith("/files/") && request.method === "DELETE") {
				const id = path.split("/").pop();
				return handleFileDelete(env, id);
			}

			if (path === "/folders" && request.method === "POST") {
				return handleFolderCreate(request, env);
			}

			if (path.startsWith("/folders/") && request.method === "PATCH") {
				const id = path.split("/").pop();
				return handleFolderRename(request, env, id);
			}

			if (path.startsWith("/folders/") && request.method === "DELETE") {
				const id = path.split("/").pop();
				return handleFolderDelete(env, id);
			}

			return jsonResponse({ error: "Not Found" }, 404);
		} catch (err: any) {
			console.error(err);
			return jsonResponse({ error: err.message || "Internal Server Error" }, 500);
		}
	},
};

// --- Handlers ---

async function handleListItems(env: Env, folderId: string | null) {
	// 1. Get current folder info
	let currentFolder = null;
	if (folderId) {
		currentFolder = await env.DB.prepare("SELECT id, name, parent_id FROM folders WHERE id = ?")
			.bind(folderId)
			.first();
	}

	// 2. Get breadcrumbs (recursive or sequential for simplicity in MVP)
	const breadcrumbs = [];
	let tempFolderId = folderId;
	while (tempFolderId) {
		const f: any = await env.DB.prepare("SELECT id, name, parent_id FROM folders WHERE id = ?")
			.bind(tempFolderId)
			.first();
		if (f) {
			breadcrumbs.unshift({ id: f.id, name: f.name });
			tempFolderId = f.parent_id;
		} else {
			break;
		}
	}

	// 3. Get children
	const folders = await env.DB.prepare("SELECT * FROM folders WHERE parent_id IS ? ORDER BY name COLLATE NOCASE")
		.bind(folderId)
		.all();
	
	const files = await env.DB.prepare("SELECT * FROM files WHERE folder_id IS ? ORDER BY name COLLATE NOCASE")
		.bind(folderId)
		.all();

	return jsonResponse({
		currentFolder,
		breadcrumbs,
		folders: folders.results,
		files: files.results,
	});
}

async function handleFileUpload(request: Request, env: Env) {
	const formData = await request.formData();
	const file = formData.get("file") as File;
	const folderId = formData.get("folderId") as string || null;

	if (!file) return jsonResponse({ error: "No file uploaded" }, 400);

	// Enforce size limit from env
	const maxBytes = parseInt(env.MAX_UPLOAD_SIZE) || 5368709120;
	if (file.size > maxBytes) {
		return jsonResponse({ error: `File too large. Max size: ${env.MAX_UPLOAD_SIZE} bytes` }, 413);
	}

	// Enforce global storage limit
	const stats: any = await env.DB.prepare("SELECT SUM(size_bytes) as used FROM files").first();
	const usedBytes = stats?.used || 0;
	const maxStorage = parseInt(env.MAX_STORAGE_SIZE) || 10737418240;

	if (usedBytes + file.size > maxStorage) {
		return jsonResponse({ error: "Storage limit reached. Cannot upload more files." }, 507);
	}

	// Validation
	const rawName = file.name.trim();
	if (!rawName || /[\/\\]/.test(rawName) || /[\x00-\x1F]/.test(rawName)) {
		return jsonResponse({ error: "Invalid filename" }, 400);
	}

	// Duplicate check (Case-insensitive)
	const duplicate = await env.DB.prepare("SELECT id FROM files WHERE folder_id IS ? AND LOWER(name) = LOWER(?)")
		.bind(folderId, rawName)
		.first();
	
	if (duplicate) {
		return jsonResponse({ error: "A file with this name already exists in this folder" }, 409);
	}

	const id = crypto.randomUUID();
	const r2Key = `files/${id}/${rawName}`;

	// Upload to R2
	await env.BUCKET.put(r2Key, file.stream(), {
		httpMetadata: { contentType: file.type },
		customMetadata: { originalName: rawName },
	});

	// Insert into D1
	await env.DB.prepare(
		"INSERT INTO files (id, name, folder_id, r2_key, size_bytes, mime_type) VALUES (?, ?, ?, ?, ?, ?)"
	)
		.bind(id, rawName, folderId, r2Key, file.size, file.type)
		.run();

	return jsonResponse({ success: true, id });
}

async function handleFileDownload(env: Env, id: string | undefined) {
	if (!id) return jsonResponse({ error: "Missing ID" }, 400);

	const file: any = await env.DB.prepare("SELECT * FROM files WHERE id = ?").bind(id).first();
	if (!file) return jsonResponse({ error: "File not found" }, 404);

	const object = await env.BUCKET.get(file.r2_key);
	if (!object) return jsonResponse({ error: "File data not found in storage" }, 404);

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	headers.set("Content-Disposition", `attachment; filename="${file.name}"`);

	// Add CORS headers for iOS/Safari download support
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Expose-Headers", "Content-Disposition");

	return new Response(object.body, { headers });
}

async function handleFileRename(request: Request, env: Env, id: string | undefined) {
	if (!id) return jsonResponse({ error: "Missing ID" }, 400);
	const { name } = await request.json() as { name: string };
	const newName = name.trim();

	if (!newName || /[\/\\]/.test(newName)) return jsonResponse({ error: "Invalid filename" }, 400);

	const file: any = await env.DB.prepare("SELECT folder_id FROM files WHERE id = ?").bind(id).first();
	if (!file) return jsonResponse({ error: "File not found" }, 404);

	// Duplicate check
	const duplicate = await env.DB.prepare("SELECT id FROM files WHERE folder_id IS ? AND LOWER(name) = LOWER(?) AND id != ?")
		.bind(file.folder_id, newName, id)
		.first();
	if (duplicate) return jsonResponse({ error: "Name already exists" }, 409);

	await env.DB.prepare("UPDATE files SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
		.bind(newName, id)
		.run();

	return jsonResponse({ success: true });
}

async function handleFileDelete(env: Env, id: string | undefined) {
	if (!id) return jsonResponse({ error: "Missing ID" }, 400);

	const file: any = await env.DB.prepare("SELECT r2_key FROM files WHERE id = ?").bind(id).first();
	if (!file) return jsonResponse({ error: "File not found" }, 404);

	// Delete from R2
	await env.BUCKET.delete(file.r2_key);

	// Delete from D1
	await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(id).run();

	return jsonResponse({ success: true });
}

async function handleFolderCreate(request: Request, env: Env) {
	const { name, parentId } = await request.json() as { name: string, parentId: string | null };
	const folderName = name.trim();

	if (!folderName || /[\/\\]/.test(folderName)) return jsonResponse({ error: "Invalid folder name" }, 400);

	// Duplicate check
	const duplicate = await env.DB.prepare("SELECT id FROM folders WHERE parent_id IS ? AND LOWER(name) = LOWER(?)")
		.bind(parentId, folderName)
		.first();
	if (duplicate) return jsonResponse({ error: "Folder already exists" }, 409);

	const id = crypto.randomUUID();
	await env.DB.prepare("INSERT INTO folders (id, name, parent_id) VALUES (?, ?, ?)")
		.bind(id, folderName, parentId)
		.run();

	return jsonResponse({ success: true, id });
}

async function handleFolderRename(request: Request, env: Env, id: string | undefined) {
	if (!id) return jsonResponse({ error: "Missing ID" }, 400);
	const { name } = await request.json() as { name: string };
	const newName = name.trim();

	if (!newName || /[\/\\]/.test(newName)) return jsonResponse({ error: "Invalid name" }, 400);

	const folder: any = await env.DB.prepare("SELECT parent_id FROM folders WHERE id = ?").bind(id).first();
	if (!folder) return jsonResponse({ error: "Not found" }, 404);

	// Duplicate check
	const duplicate = await env.DB.prepare("SELECT id FROM folders WHERE parent_id IS ? AND LOWER(name) = LOWER(?) AND id != ?")
		.bind(folder.parent_id, newName, id)
		.first();
	if (duplicate) return jsonResponse({ error: "Name exists" }, 409);

	await env.DB.prepare("UPDATE folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
		.bind(newName, id)
		.run();

	return jsonResponse({ success: true });
}

async function handleFolderDelete(env: Env, id: string | undefined) {
	if (!id) return jsonResponse({ error: "Missing ID" }, 400);

	// Check if empty
	const childFolder = await env.DB.prepare("SELECT id FROM folders WHERE parent_id = ?").bind(id).first();
	const childFile = await env.DB.prepare("SELECT id FROM files WHERE folder_id = ?").bind(id).first();

	if (childFolder || childFile) {
		return jsonResponse({ error: "Folder is not empty" }, 400);
	}

	await env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(id).run();

	return jsonResponse({ success: true });
}

async function handleStorageStats(env: Env) {
	const stats: any = await env.DB.prepare("SELECT SUM(size_bytes) as used FROM files").first();
	return jsonResponse({
		usedBytes: stats?.used || 0,
		maxBytes: parseInt(env.MAX_STORAGE_SIZE) || 10737418240,
	});
}

// --- Helpers ---

function jsonResponse(data: any, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
