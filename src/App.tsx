import { useState, useEffect, useCallback } from "react";
import { AuthGate } from "./components/AuthGate";
import { FileBrowser } from "./components/FileBrowser";
import { Uploader } from "./components/Uploader";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { IOSInstallHint } from "./components/iOSInstallHint";
import { 
  isUnlocked, 
  listItems,
  createFolder, 
  renameItem, 
  deleteItem,
  getStorageStats,
  API_ROOT
} from "./api";
import type { Folder, FileItem, Breadcrumb } from "./types";
import { LogOut, RefreshCw, HardDrive } from "lucide-react";

function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [storageStats, setStorageStats] = useState<{ usedBytes: number, maxBytes: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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

  const handleDownload = (id: string) => {
    const secret = localStorage.getItem("sendit_secret");
    const downloadUrl = `${API_ROOT}/files/${id}?secret=${secret}`;
    
    // Create a temporary link to trigger download (more reliable on iOS)
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    localStorage.removeItem("sendit_secret");
    setUnlocked(false);
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
            onRename={handleRename}
            onDelete={handleDelete}
            onDownload={handleDownload}
            onCreateFolder={handleCreateFolder}
          />
        </div>
      </main>

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

export default App;
