import React, { useState, useRef } from "react";
import { uploadFile } from "../api";
import type { UploadProgress } from "../types";
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UploaderProps {
  currentFolderId: string | null;
  onUploadComplete: () => void;
}

export function Uploader({ currentFolderId, onUploadComplete }: UploaderProps) {
  const [queue, setQueue] = useState<UploadProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startUpload = async (files: FileList) => {
    const newItems: UploadProgress[] = Array.from(files).map((f) => ({
      fileId: Math.random().toString(36).slice(2),
      fileName: f.name,
      progress: 0,
      status: "uploading",
    }));

    setQueue((prev) => [...newItems, ...prev]);

    const MAX_SIZE = 5368709120; // 5GB - Matches wrangler.toml

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const queueItem = newItems[i];
        
        if (file.size > MAX_SIZE) {
            setQueue(prev => prev.map(item => 
                item.fileId === queueItem.fileId ? { ...item, status: 'error', error: "File too large (max 5GB)" } : item
            ));
            continue;
        }

        try {
            await uploadFile(file, currentFolderId, (progress) => {
                setQueue(prev => prev.map(item => 
                    item.fileId === queueItem.fileId ? { ...item, progress } : item
                ));
            });
            setQueue(prev => prev.map(item => 
                item.fileId === queueItem.fileId ? { ...item, status: 'completed', progress: 100 } : item
            ));
        } catch (err: any) {
            setQueue(prev => prev.map(item => 
                item.fileId === queueItem.fileId ? { ...item, status: 'error', error: err.message } : item
            ));
        }
    }
    onUploadComplete();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) startUpload(e.dataTransfer.files);
  };

  const removeQueueItem = (id: string) => {
    setQueue(prev => prev.filter(item => item.fileId !== id));
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative group border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
          isDragging ? "border-zinc-400 bg-zinc-800/50" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/30"
        )}
      >
        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => e.target.files && startUpload(e.target.files)}
        />
        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Upload className="text-zinc-400" />
        </div>
        <div className="text-center">
          <p className="text-zinc-300 font-medium">Click or drag files here</p>
          <p className="text-zinc-500 text-sm mt-1">Up to 5GB per file</p>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/80">
            <h3 className="font-semibold text-zinc-300">Upload Activity</h3>
            <button 
                onClick={() => setQueue([])}
                className="text-xs text-zinc-500 hover:text-zinc-300"
            >
                Clear all
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800/50">
            {queue.map((item) => (
              <div key={item.fileId} className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-300 truncate">{item.fileName}</p>
                    {item.error && <p className="text-xs text-rose-500 mt-0.5">{item.error}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'uploading' && <Loader2 className="animate-spin text-zinc-500" size={14} />}
                    {item.status === 'completed' && <CheckCircle2 className="text-emerald-500" size={14} />}
                    {item.status === 'error' && <AlertCircle className="text-rose-500" size={14} />}
                    <button onClick={() => removeQueueItem(item.fileId)} className="text-zinc-600 hover:text-zinc-400">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                        "h-full transition-all duration-300",
                        item.status === 'error' ? "bg-rose-500" : item.status === 'completed' ? "bg-emerald-500" : "bg-blue-500"
                    )}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
