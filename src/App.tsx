import { useState, useEffect, useCallback } from "react";
import { AuthGate } from "./components/AuthGate";
import { FileBrowser } from "./components/FileBrowser";
import { Uploader } from "./components/Uploader";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { IOSInstallHint } from "./components/iOSInstallHint";
import { ClipboardPanel } from "./components/ClipboardPanel";
import { FilePreviewModal } from "./components/FilePreviewModal";
import { 
  isUnlocked, 
  listItems,
  createFolder, 
  renameItem, 
  deleteItem,
  getStorageStats,
  listClipboardEntries,
  createClipboardEntry,
  deleteClipboardEntry,
  ClipboardUnavailableError,
  API_ROOT
} from "./api";
import type { Folder, FileItem, Breadcrumb, ClipboardEntry } from "./types";
import { LogOut, RefreshCw, HardDrive } from "lucide-react";

function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [clipboardEntries, setClipboardEntries] = useState<ClipboardEntry[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [storageStats, setStorageStats] = useState<{ usedBytes: number, maxBytes: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [isSavingClipboard, setIsSavingClipboard] = useState(false);
  const [isCopyingClipboard, setIsCopyingClipboard] = useState(false);
  const [copyingClipboardEntryId, setCopyingClipboardEntryId] = useState<string | null>(null);
  const [deletingClipboardEntryId, setDeletingClipboardEntryId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [clipboardError, setClipboardError] = useState("");
  const [clipboardStatus, setClipboardStatus] = useState("");
  const [isClipboardAvailable, setIsClipboardAvailable] = useState(true);

  const fetchData = useCallback(async () => {
    if (!unlocked) return;
    setIsLoading(true);
    setError("");
    try {
      const [itemsData, statsData] = await Promise.all([
        listItems(currentFolderId),
        getStorageStats()
      ]);
      setFolders(itemsData.folders);
      setFiles(itemsData.files);
      setBreadcrumbs(itemsData.breadcrumbs);
      setStorageStats(statsData);

      try {
        const clipboardData = await listClipboardEntries();
        setClipboardEntries(clipboardData);
        setClipboardError("");
        setIsClipboardAvailable(true);
      } catch (err: any) {
        if (err instanceof ClipboardUnavailableError) {
          setClipboardEntries([]);
          setClipboardError("Clipboard backend is not deployed yet.");
          setIsClipboardAvailable(false);
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      if (err.message === "Unauthorized") {
        handleLogout();
      } else {
        setError(err.message || "Failed to load items");
      }
    } finally {
      setIsLoading(false);
    }
  }, [unlocked, currentFolderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!clipboardStatus) return;

    const timer = window.setTimeout(() => {
      setClipboardStatus("");
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [clipboardStatus]);

  const handleCreateFolder = async () => {
    const name = window.prompt("Enter folder name:");
    if (!name) return;
    try {
      await createFolder(name, currentFolderId);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRename = async (type: 'file' | 'folder', id: string, oldName: string) => {
    const name = window.prompt(`Rename ${type}:`, oldName);
    if (!name || name === oldName) return;
    try {
      await renameItem(type, id, name);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (type: 'file' | 'folder', id: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      await deleteItem(type, id);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDownload = async (file: FileItem) => {
    const secret = localStorage.getItem("sendit_secret");
    if (!secret) {
      handleLogout();
      return;
    }

    setDownloadingFileId(file.id);

    try {
      const res = await fetch(`${API_ROOT}/files/${file.id}`, {
        headers: {
          Authorization: secret,
        },
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await res.blob();
      const fileBlob = blob.type ? blob : new Blob([blob], {
        type: file.mime_type || "application/octet-stream",
      });
      const sharedFile = new File([fileBlob], file.name, {
        type: fileBlob.type || file.mime_type || "application/octet-stream",
      });

      if (canShareFile(sharedFile)) {
        try {
          await navigator.share({
            files: [sharedFile],
            title: file.name,
          });
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") {
            return;
          }
        }
      }

      downloadBlob(fileBlob, file.name);
    } catch (err: any) {
      alert(err.message || "Failed to download file");
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handlePreviewFile = (file: FileItem) => {
    setPreviewFile(file);
  };

  const handleLogout = () => {
    localStorage.removeItem("sendit_secret");
    setUnlocked(false);
  };

  const handleClipboardSave = async (content: string) => {
    if (!isClipboardAvailable) {
      setClipboardError("Deploy the worker update first, then paste again.");
      return;
    }

    setIsSavingClipboard(true);
    setClipboardError("");

    try {
      const entry = await createClipboardEntry(content);
      setClipboardEntries((prev) => [entry, ...prev]);
      setClipboardStatus("Saved to clipboard.");
    } catch (err: any) {
      if (err.message === "Unauthorized") {
        handleLogout();
        return;
      }

      if (err instanceof ClipboardUnavailableError) {
        setIsClipboardAvailable(false);
        setClipboardError("Clipboard backend is not deployed yet.");
        return;
      }

      setClipboardError(err.message || "Failed to save clipboard text");
      throw err;
    } finally {
      setIsSavingClipboard(false);
    }
  };

  const handleCopyAllClipboard = async () => {
    if (clipboardEntries.length === 0) return;

    setIsCopyingClipboard(true);
    setClipboardError("");

    try {
      const combinedText = clipboardEntries
        .slice()
        .reverse()
        .map((entry) => entry.content)
        .join("\n\n");

      await copyText(combinedText);
      setClipboardStatus("Copied all saved clipboard text.");
    } catch (err: any) {
      setClipboardError(err.message || "Failed to copy clipboard text");
    } finally {
      setIsCopyingClipboard(false);
    }
  };

  const handleCopyClipboardEntry = async (entry: ClipboardEntry) => {
    setCopyingClipboardEntryId(entry.id);
    setClipboardError("");

    try {
      await copyText(entry.content);
      setClipboardStatus("Copied clipboard text.");
    } catch (err: any) {
      setClipboardError(err.message || "Failed to copy clipboard text");
    } finally {
      setCopyingClipboardEntryId(null);
    }
  };

  const handleDeleteClipboardEntry = async (entryId: string) => {
    if (!window.confirm("Delete this saved clipboard text?")) return;

    setDeletingClipboardEntryId(entryId);
    setClipboardError("");

    try {
      await deleteClipboardEntry(entryId);
      setClipboardEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      setClipboardStatus("Deleted clipboard text.");
    } catch (err: any) {
      if (err.message === "Unauthorized") {
        handleLogout();
        return;
      }

      if (err instanceof ClipboardUnavailableError) {
        setIsClipboardAvailable(false);
        setClipboardError("Clipboard backend is not deployed yet.");
        return;
      }

      setClipboardError(err.message || "Failed to delete clipboard text");
    } finally {
      setDeletingClipboardEntryId(null);
    }
  };

  if (!unlocked) {
    return <AuthGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-zinc-800">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
              <HardDrive className="text-zinc-400" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-500">
                Sendit
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                Personal Storage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
                onClick={fetchData}
                disabled={isLoading}
                className="p-2.5 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors disabled:opacity-50"
                title="Refresh"
            >
                <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button 
                onClick={handleLogout}
                className="p-2.5 hover:bg-zinc-800 rounded-xl text-rose-500 transition-colors"
                title="Logout"
            >
                <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar / Upload Panel */}
        <div className="lg:col-span-1 space-y-6">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider px-1">Uploads</h2>
            <Uploader 
              currentFolderId={currentFolderId} 
              onUploadComplete={fetchData} 
            />
          </section>

          <ClipboardPanel
            entries={clipboardEntries}
            error={clipboardError}
            statusMessage={clipboardStatus}
            isSaving={isSavingClipboard}
            isCopying={isCopyingClipboard}
            copyingEntryId={copyingClipboardEntryId}
            deletingEntryId={deletingClipboardEntryId}
            onPasteText={handleClipboardSave}
            onCopyAll={handleCopyAllClipboard}
            onCopyEntry={handleCopyClipboardEntry}
            onDeleteEntry={handleDeleteClipboardEntry}
          />

          <section className="hidden lg:block bg-zinc-900/30 border border-zinc-900 p-5 rounded-3xl">
            <h3 className="text-sm font-semibold text-zinc-400 mb-4">Storage Info</h3>
            <div className="space-y-3">
                {storageStats ? (
                  <>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-zinc-100 transition-all duration-500" 
                          style={{ width: `${Math.min(100, (storageStats.usedBytes / storageStats.maxBytes) * 100)}%` }} 
                        />
                    </div>
                    <div className="flex justify-between text-[11px] font-medium tracking-tight">
                        <span className="text-zinc-300">
                          {formatSize(storageStats.usedBytes)} used
                        </span>
                        <span className="text-zinc-500">
                          {formatSize(storageStats.maxBytes)} total
                        </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-zinc-500">Loading storage info...</p>
                )}
            </div>
          </section>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Breadcrumbs items={breadcrumbs} onNavigate={setCurrentFolderId} />
            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-2 rounded-xl text-sm">
                    {error}
                </div>
            )}
          </div>
          
          <FileBrowser 
            folders={folders}
            files={files}
            onNavigate={setCurrentFolderId}
            onPreview={handlePreviewFile}
            onRename={handleRename}
            onDelete={handleDelete}
            onDownload={handleDownload}
            onCreateFolder={handleCreateFolder}
            downloadingFileId={downloadingFileId}
          />
        </div>
      </main>

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          previewUrl={buildFilePreviewUrl(previewFile.id)}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
          isDownloading={downloadingFileId === previewFile.id}
        />
      )}

      {/* Footer */}
      <footer className="py-8 text-center border-t border-zinc-900 mt-12">
        <p className="text-zinc-600 text-sm">
          Sendit &copy; 2024 &bull; Built with Cloudflare D1 + R2
        </p>
      </footer>
      <IOSInstallHint />
    </div>
  );
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  const succeeded = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!succeeded) {
    throw new Error("Clipboard copy is not supported in this browser");
  }
}

function canShareFile(file: File) {
  return typeof navigator.share === "function"
    && typeof navigator.canShare === "function"
    && navigator.canShare({ files: [file] });
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function buildFilePreviewUrl(fileId: string) {
  const secret = localStorage.getItem("sendit_secret");
  const url = new URL(`${API_ROOT}/files/${fileId}`);

  if (secret) {
    url.searchParams.set("secret", secret);
  }

  url.searchParams.set("inline", "1");
  return url.toString();
}

export default App;
