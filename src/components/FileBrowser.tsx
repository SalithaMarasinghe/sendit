import { useState, useMemo } from "react";
import type { Folder, FileItem } from "../types";
import { 
  Folder as FolderIcon, 
  File, 
  MoreVertical, 
  Download, 
  Trash2, 
  Edit2, 
  Search,
  ArrowUpDown,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Plus
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileBrowserProps {
  folders: Folder[];
  files: FileItem[];
  onNavigate: (id: string) => void;
  onRename: (type: 'file' | 'folder', id: string, name: string) => void;
  onDelete: (type: 'file' | 'folder', id: string) => void;
  onDownload: (id: string) => void;
  onCreateFolder: () => void;
}

type SortKey = 'name' | 'size' | 'date';

export function FileBrowser({ 
  folders, 
  files, 
  onNavigate, 
  onRename, 
  onDelete, 
  onDownload,
  onCreateFolder
}: FileBrowserProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [activeMenu, setActiveMenu] = useState<{ type: 'file' | 'folder', id: string } | null>(null);

  const filteredItems = useMemo(() => {
    const query = search.toLowerCase();
    
    let resultFolders = folders.filter(f => f.name.toLowerCase().includes(query));
    let resultFiles = files.filter(f => f.name.toLowerCase().includes(query));

    const sortFn = (a: any, b: any) => {
      let comparison = 0;
      if (sortKey === 'name') comparison = a.name.localeCompare(b.name);
      else if (sortKey === 'size') comparison = (a.size_bytes || 0) - (b.size_bytes || 0);
      else if (sortKey === 'date') comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      
      return sortOrder === 'asc' ? comparison : -comparison;
    };

    return {
      folders: resultFolders.sort(sortFn),
      files: resultFiles.sort(sortFn)
    };
  }, [folders, files, search, sortKey, sortOrder]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes('image')) return <ImageIcon size={20} className="text-blue-400" />;
    if (mime.includes('video')) return <Video size={20} className="text-purple-400" />;
    if (mime.includes('audio')) return <Music size={20} className="text-pink-400" />;
    if (mime.includes('text') || mime.includes('pdf')) return <FileText size={20} className="text-orange-400" />;
    return <File size={20} className="text-zinc-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-3xl border border-zinc-900 overflow-hidden shadow-2xl">
      {/* Search and Filter Bar */}
      <div className="p-4 border-b border-zinc-900 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Search in this folder..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={onCreateFolder}
                className="p-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors border border-zinc-700"
            >
                <Plus size={16} /> New Folder
            </button>
            <div className="h-8 w-[1px] bg-zinc-800 mx-1" />
            <button 
                onClick={() => toggleSort('name')}
                className={cn("p-2 rounded-lg text-sm transition-colors flex items-center gap-1", sortKey === 'name' ? "text-zinc-100 bg-zinc-800" : "text-zinc-500 hover:text-zinc-300")}
            >
                Name {sortKey === 'name' && <ArrowUpDown size={14} />}
            </button>
            <button 
                onClick={() => toggleSort('date')}
                className={cn("p-2 rounded-lg text-sm transition-colors flex items-center gap-1", sortKey === 'date' ? "text-zinc-100 bg-zinc-800" : "text-zinc-500 hover:text-zinc-300")}
            >
                Date {sortKey === 'date' && <ArrowUpDown size={14} />}
            </button>
        </div>
      </div>

      {/* Grid View */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {filteredItems.folders.length === 0 && filteredItems.files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3 py-20">
            <div className="w-16 h-16 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800/50">
                <File size={32} />
            </div>
            <p className="text-lg font-medium text-zinc-500">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {/* Folders */}
            {filteredItems.folders.map((folder: Folder) => (
              <div 
                key={folder.id} 
                className="group bg-zinc-900/40 border border-zinc-900 p-4 rounded-2xl hover:bg-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer relative"
                onClick={() => onNavigate(folder.id)}
              >
                <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20 mb-3 group-hover:scale-105 transition-transform">
                        <FolderIcon className="text-amber-500" size={24} />
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu?.id === folder.id ? null : { type: 'folder', id: folder.id }); }}
                        className="p-1 hover:bg-zinc-700 rounded-lg text-zinc-500 transition-colors"
                    >
                        <MoreVertical size={16} />
                    </button>
                </div>
                <h4 className="text-sm font-medium text-zinc-200 truncate pr-4">{folder.name}</h4>
                <p className="text-xs text-zinc-500 mt-1">Folder</p>

                {/* Context Menu Placeholder */}
                {activeMenu?.id === folder.id && activeMenu.type === 'folder' && (
                  <div className="absolute right-4 top-12 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-20 py-1 min-w-[140px] animate-in fade-in zoom-in duration-200">
                    <button onClick={(e) => { e.stopPropagation(); onRename('folder', folder.id, folder.name); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2">
                        <Edit2 size={14} /> Rename
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete('folder', folder.id); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 flex items-center gap-2">
                        <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Files */}
            {filteredItems.files.map((file: FileItem) => (
              <div 
                key={file.id} 
                className="group bg-zinc-900/40 border border-zinc-900 p-4 rounded-2xl hover:bg-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer relative"
              >
                <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700 mb-3 group-hover:scale-105 transition-transform">
                        {getFileIcon(file.mime_type || '')}
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu?.id === file.id ? null : { type: 'file', id: file.id }); }}
                        className="p-1 hover:bg-zinc-700 rounded-lg text-zinc-500 transition-colors"
                    >
                        <MoreVertical size={16} />
                    </button>
                </div>
                <h4 className="text-sm font-medium text-zinc-200 truncate pr-4" title={file.name}>{file.name}</h4>
                <p className="text-xs text-zinc-500 mt-1">{formatSize(file.size_bytes)}</p>

                {/* Context Menu Placeholder */}
                {activeMenu?.id === file.id && activeMenu.type === 'file' && (
                  <div className="absolute right-4 top-12 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-20 py-1 min-w-[140px] animate-in fade-in zoom-in duration-200">
                    <button onClick={(e) => { e.stopPropagation(); onDownload(file.id); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-emerald-500 hover:bg-emerald-500/10 flex items-center gap-2">
                        <Download size={14} /> Download
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onRename('file', file.id, file.name); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2">
                        <Edit2 size={14} /> Rename
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete('file', file.id); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 flex items-center gap-2">
                        <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Background click listener to close menu */}
      {activeMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
      )}
    </div>
  );
}
