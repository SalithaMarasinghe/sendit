import type { ItemsResponse } from "./types";

export const API_ROOT = "https://sendit-api.sendit-network.workers.dev";
console.log("Sendit v1.1.0 - API_ROOT:", API_ROOT);

export const getAuthSecret = () => localStorage.getItem("sendit_secret") || "";
export const setAuthSecret = (secret: string) => localStorage.setItem("sendit_secret", secret);
export const isUnlocked = () => !!getAuthSecret();

const getHeaders = () => ({
  "Authorization": getAuthSecret(),
  "Content-Type": "application/json",
});

export async function unlock(secret: string) {
  const res = await fetch(`${API_ROOT}/auth/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret }),
  });
  if (!res.ok) throw new Error("Invalid passcode");
  setAuthSecret(secret);
  return true;
}

export async function listItems(folderId: string | null): Promise<ItemsResponse> {
  const url = new URL(`${API_ROOT}/items`, window.location.origin);
  if (folderId) url.searchParams.set("folderId", folderId);

  const res = await fetch(url.toString(), { headers: getHeaders() });
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error("Failed to fetch items");
  return res.json();
}

export async function createFolder(name: string, parentId: string | null) {
  const res = await fetch(`${API_ROOT}/folders`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ name, parentId }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to create folder");
  }
  return res.json();
}

export async function renameItem(type: 'file' | 'folder', id: string, name: string) {
  const endpoint = type === 'file' ? 'files' : 'folders';
  const res = await fetch(`${API_ROOT}/${endpoint}/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to rename");
  }
  return res.json();
}

export async function deleteItem(type: 'file' | 'folder', id: string) {
  const endpoint = type === 'file' ? 'files' : 'folders';
  const res = await fetch(`${API_ROOT}/${endpoint}/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete");
  }
  return res.json();
}

export function uploadFile(
  file: File,
  folderId: string | null,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    if (folderId) formData.append("folderId", folderId);

    xhr.open("POST", `${API_ROOT}/files/upload`);
    xhr.setRequestHeader("Authorization", getAuthSecret());

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        const response = JSON.parse(xhr.responseText || "{}");
        reject(new Error(response.error || "Upload failed"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

export async function getStorageStats(): Promise<{ usedBytes: number, maxBytes: number }> {
  try {
    const res = await fetch(`${API_ROOT}/storage/stats`, { headers: getHeaders() });
    if (res.status === 401) throw new Error("Unauthorized");
    if (!res.ok) throw new Error("Failed to fetch storage stats");
    return res.json();
  } catch (err) {
    console.error("Storage stats error:", err);
    return { usedBytes: 0, maxBytes: 10737418240 }; // Fallback to 10GB
  }
}
