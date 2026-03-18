import { useEffect, useState } from "react";
import type { FileItem } from "../types";
import { Download, FileText, Loader2, X } from "lucide-react";

interface FilePreviewModalProps {
  file: FileItem;
  previewUrl: string;
  onClose: () => void;
  onDownload: (file: FileItem) => void;
  isDownloading: boolean;
}

export function FilePreviewModal({
  file,
  previewUrl,
  onClose,
  onDownload,
  isDownloading,
}: FilePreviewModalProps) {
  const [textPreview, setTextPreview] = useState("");
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [textError, setTextError] = useState("");

  useEffect(() => {
    if (!shouldRenderText(file)) {
      setTextPreview("");
      setTextError("");
      setIsLoadingText(false);
      return;
    }

    let cancelled = false;
    setIsLoadingText(true);
    setTextError("");

    fetch(previewUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Preview unavailable");
        }
        return response.text();
      })
      .then((content) => {
        if (!cancelled) {
          setTextPreview(content);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setTextError(err.message || "Preview unavailable");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingText(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file, previewUrl]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-900 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-100">{file.name}</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
              {file.mime_type || "Unknown type"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDownload(file)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
            >
              {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-[320px] flex-1 overflow-auto bg-black/40 p-4 md:p-6">
          {renderPreview(file, previewUrl, textPreview, isLoadingText, textError)}
        </div>
      </div>
    </div>
  );
}

function renderPreview(
  file: FileItem,
  previewUrl: string,
  textPreview: string,
  isLoadingText: boolean,
  textError: string,
) {
  const mimeType = file.mime_type || "";

  if (mimeType.startsWith("image/")) {
    return (
      <img
        src={previewUrl}
        alt={file.name}
        className="mx-auto max-h-[70vh] w-auto max-w-full rounded-2xl object-contain"
      />
    );
  }

  if (mimeType.startsWith("video/")) {
    return (
      <video
        src={previewUrl}
        controls
        className="mx-auto max-h-[70vh] w-full rounded-2xl bg-black"
      />
    );
  }

  if (mimeType.startsWith("audio/")) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center">
        <audio src={previewUrl} controls className="w-full max-w-xl" />
      </div>
    );
  }

  if (mimeType === "application/pdf") {
    return <iframe src={previewUrl} title={file.name} className="h-[70vh] w-full rounded-2xl bg-white" />;
  }

  if (shouldRenderText(file)) {
    if (isLoadingText) {
      return (
        <div className="flex h-full min-h-[240px] items-center justify-center gap-2 text-zinc-400">
          <Loader2 size={18} className="animate-spin" />
          <span>Loading preview...</span>
        </div>
      );
    }

    if (textError) {
      return <FallbackPreview message={textError} />;
    }

    return (
      <pre className="min-h-[240px] whitespace-pre-wrap break-words rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-200">
        {textPreview}
      </pre>
    );
  }

  return <FallbackPreview message="Preview is not available for this file type yet." />;
}

function shouldRenderText(file: FileItem) {
  const mimeType = file.mime_type || "";
  return mimeType.startsWith("text/")
    || mimeType.includes("json")
    || mimeType.includes("xml")
    || mimeType.includes("javascript")
    || mimeType.includes("svg");
}

function FallbackPreview({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 p-8 text-center">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 text-zinc-400">
        <FileText size={28} />
      </div>
      <p className="max-w-md text-sm text-zinc-400">{message}</p>
    </div>
  );
}
