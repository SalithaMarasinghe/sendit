var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-zul4CF/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// worker/src/index.ts
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith("/api")) {
      path = path.replace("/api", "");
    }
    if (path === "") path = "/";
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    if (path === "/auth/unlock" && request.method === "POST") {
      const { secret } = await request.json();
      if (secret === env.AUTH_SECRET) {
        return jsonResponse({ success: true });
      }
      return jsonResponse({ error: "Invalid secret" }, 401);
    }
    const authHeader = request.headers.get("Authorization");
    const secretParam = url.searchParams.get("secret");
    if ((!authHeader || authHeader !== env.AUTH_SECRET) && (!secretParam || secretParam !== env.AUTH_SECRET)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    try {
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
    } catch (err) {
      console.error(err);
      return jsonResponse({ error: err.message || "Internal Server Error" }, 500);
    }
  }
};
async function handleListItems(env, folderId) {
  let currentFolder = null;
  if (folderId) {
    currentFolder = await env.DB.prepare("SELECT id, name, parent_id FROM folders WHERE id = ?").bind(folderId).first();
  }
  const breadcrumbs = [];
  let tempFolderId = folderId;
  while (tempFolderId) {
    const f = await env.DB.prepare("SELECT id, name, parent_id FROM folders WHERE id = ?").bind(tempFolderId).first();
    if (f) {
      breadcrumbs.unshift({ id: f.id, name: f.name });
      tempFolderId = f.parent_id;
    } else {
      break;
    }
  }
  const folders = await env.DB.prepare("SELECT * FROM folders WHERE parent_id IS ? ORDER BY name COLLATE NOCASE").bind(folderId).all();
  const files = await env.DB.prepare("SELECT * FROM files WHERE folder_id IS ? ORDER BY name COLLATE NOCASE").bind(folderId).all();
  return jsonResponse({
    currentFolder,
    breadcrumbs,
    folders: folders.results,
    files: files.results
  });
}
__name(handleListItems, "handleListItems");
async function handleFileUpload(request, env) {
  const formData = await request.formData();
  const file = formData.get("file");
  const folderId = formData.get("folderId") || null;
  if (!file) return jsonResponse({ error: "No file uploaded" }, 400);
  const maxBytes = parseInt(env.MAX_UPLOAD_SIZE) || 5368709120;
  if (file.size > maxBytes) {
    return jsonResponse({ error: `File too large. Max size: ${env.MAX_UPLOAD_SIZE} bytes` }, 413);
  }
  const stats = await env.DB.prepare("SELECT SUM(size_bytes) as used FROM files").first();
  const usedBytes = stats?.used || 0;
  const maxStorage = parseInt(env.MAX_STORAGE_SIZE) || 10737418240;
  if (usedBytes + file.size > maxStorage) {
    return jsonResponse({ error: "Storage limit reached. Cannot upload more files." }, 507);
  }
  const rawName = file.name.trim();
  if (!rawName || /[\/\\]/.test(rawName) || /[\x00-\x1F]/.test(rawName)) {
    return jsonResponse({ error: "Invalid filename" }, 400);
  }
  const duplicate = await env.DB.prepare("SELECT id FROM files WHERE folder_id IS ? AND LOWER(name) = LOWER(?)").bind(folderId, rawName).first();
  if (duplicate) {
    return jsonResponse({ error: "A file with this name already exists in this folder" }, 409);
  }
  const id = crypto.randomUUID();
  const r2Key = `files/${id}/${rawName}`;
  await env.BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: rawName }
  });
  await env.DB.prepare(
    "INSERT INTO files (id, name, folder_id, r2_key, size_bytes, mime_type) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, rawName, folderId, r2Key, file.size, file.type).run();
  return jsonResponse({ success: true, id });
}
__name(handleFileUpload, "handleFileUpload");
async function handleFileDownload(env, id) {
  if (!id) return jsonResponse({ error: "Missing ID" }, 400);
  const file = await env.DB.prepare("SELECT * FROM files WHERE id = ?").bind(id).first();
  if (!file) return jsonResponse({ error: "File not found" }, 404);
  const object = await env.BUCKET.get(file.r2_key);
  if (!object) return jsonResponse({ error: "File data not found in storage" }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Content-Disposition", `attachment; filename="${file.name}"`);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Expose-Headers", "Content-Disposition");
  return new Response(object.body, { headers });
}
__name(handleFileDownload, "handleFileDownload");
async function handleFileRename(request, env, id) {
  if (!id) return jsonResponse({ error: "Missing ID" }, 400);
  const { name } = await request.json();
  const newName = name.trim();
  if (!newName || /[\/\\]/.test(newName)) return jsonResponse({ error: "Invalid filename" }, 400);
  const file = await env.DB.prepare("SELECT folder_id FROM files WHERE id = ?").bind(id).first();
  if (!file) return jsonResponse({ error: "File not found" }, 404);
  const duplicate = await env.DB.prepare("SELECT id FROM files WHERE folder_id IS ? AND LOWER(name) = LOWER(?) AND id != ?").bind(file.folder_id, newName, id).first();
  if (duplicate) return jsonResponse({ error: "Name already exists" }, 409);
  await env.DB.prepare("UPDATE files SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(newName, id).run();
  return jsonResponse({ success: true });
}
__name(handleFileRename, "handleFileRename");
async function handleFileDelete(env, id) {
  if (!id) return jsonResponse({ error: "Missing ID" }, 400);
  const file = await env.DB.prepare("SELECT r2_key FROM files WHERE id = ?").bind(id).first();
  if (!file) return jsonResponse({ error: "File not found" }, 404);
  await env.BUCKET.delete(file.r2_key);
  await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true });
}
__name(handleFileDelete, "handleFileDelete");
async function handleFolderCreate(request, env) {
  const { name, parentId } = await request.json();
  const folderName = name.trim();
  if (!folderName || /[\/\\]/.test(folderName)) return jsonResponse({ error: "Invalid folder name" }, 400);
  const duplicate = await env.DB.prepare("SELECT id FROM folders WHERE parent_id IS ? AND LOWER(name) = LOWER(?)").bind(parentId, folderName).first();
  if (duplicate) return jsonResponse({ error: "Folder already exists" }, 409);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO folders (id, name, parent_id) VALUES (?, ?, ?)").bind(id, folderName, parentId).run();
  return jsonResponse({ success: true, id });
}
__name(handleFolderCreate, "handleFolderCreate");
async function handleFolderRename(request, env, id) {
  if (!id) return jsonResponse({ error: "Missing ID" }, 400);
  const { name } = await request.json();
  const newName = name.trim();
  if (!newName || /[\/\\]/.test(newName)) return jsonResponse({ error: "Invalid name" }, 400);
  const folder = await env.DB.prepare("SELECT parent_id FROM folders WHERE id = ?").bind(id).first();
  if (!folder) return jsonResponse({ error: "Not found" }, 404);
  const duplicate = await env.DB.prepare("SELECT id FROM folders WHERE parent_id IS ? AND LOWER(name) = LOWER(?) AND id != ?").bind(folder.parent_id, newName, id).first();
  if (duplicate) return jsonResponse({ error: "Name exists" }, 409);
  await env.DB.prepare("UPDATE folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(newName, id).run();
  return jsonResponse({ success: true });
}
__name(handleFolderRename, "handleFolderRename");
async function handleFolderDelete(env, id) {
  if (!id) return jsonResponse({ error: "Missing ID" }, 400);
  const childFolder = await env.DB.prepare("SELECT id FROM folders WHERE parent_id = ?").bind(id).first();
  const childFile = await env.DB.prepare("SELECT id FROM files WHERE folder_id = ?").bind(id).first();
  if (childFolder || childFile) {
    return jsonResponse({ error: "Folder is not empty" }, 400);
  }
  await env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true });
}
__name(handleFolderDelete, "handleFolderDelete");
async function handleStorageStats(env) {
  const stats = await env.DB.prepare("SELECT SUM(size_bytes) as used FROM files").first();
  return jsonResponse({
    usedBytes: stats?.used || 0,
    maxBytes: parseInt(env.MAX_STORAGE_SIZE) || 10737418240
  });
}
__name(handleStorageStats, "handleStorageStats");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse, "jsonResponse");

// C:/Users/maras/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/maras/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-zul4CF/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/maras/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-zul4CF/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
