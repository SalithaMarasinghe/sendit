import { useState } from "react";
import type { ClipboardEntry } from "../types";
import { Check, ClipboardPaste, Copy, Loader2, Save, Trash2 } from "lucide-react";

interface ClipboardPanelProps {
  entries: ClipboardEntry[];
  error: string;
  statusMessage: string;
  isSaving: boolean;
  isCopying: boolean;
  copyingEntryId: string | null;
  deletingEntryId: string | null;
  onPasteText: (content: string) => Promise<void>;
  onCopyAll: () => Promise<void>;
  onCopyEntry: (entry: ClipboardEntry) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
}

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function ClipboardPanel({
  entries,
  error,
  statusMessage,
  isSaving,
  isCopying,
  copyingEntryId,
  deletingEntryId,
  onPasteText,
  onCopyAll,
  onCopyEntry,
  onDeleteEntry,
}: ClipboardPanelProps) {
  const [draft, setDraft] = useState("");

  const saveValue = async (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    try {
      await onPasteText(trimmedValue);
      setDraft((currentDraft) => (currentDraft === value ? "" : currentDraft));
    } catch {
      // Error state is rendered by the parent panel.
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Clipboard</h2>
          <p className="text-xs text-zinc-600 mt-1">
            Type or paste text, save it, then copy or remove entries anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onCopyAll()}
          disabled={entries.length === 0 || isCopying}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCopying ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
          Copy all
        </button>
      </div>

      <div className="rounded-3xl border border-zinc-900 bg-zinc-900/30 p-4">
        <label className="block text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
          Live paste
        </label>
        <textarea
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type here or paste with Ctrl+V / Cmd+V, then click Save."
          className="mt-3 w-full resize-none rounded-2xl border border-dashed border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600 focus:bg-black/60"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void saveValue(draft)}
            disabled={!draft.trim() || isSaving}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-700 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>

        <div className="mt-3 flex min-h-5 items-center gap-2 text-xs">
          {isSaving && (
            <>
              <Loader2 size={14} className="animate-spin text-zinc-400" />
              <span className="text-zinc-400">Saving text...</span>
            </>
          )}
          {!isSaving && statusMessage && (
            <>
              <Check size={14} className="text-emerald-500" />
              <span className="text-emerald-400">{statusMessage}</span>
            </>
          )}
          {!isSaving && !statusMessage && !error && (
            <span className="text-zinc-600">Type or paste text, then click Save to add it below.</span>
          )}
          {error && <span className="text-rose-400">{error}</span>}
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-900 bg-zinc-950 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-300">Saved clipboard text</h3>
          <span className="text-xs text-zinc-500">{entries.length} item{entries.length === 1 ? "" : "s"}</span>
        </div>

        {entries.length === 0 ? (
          <div className="px-4 py-8 text-sm text-zinc-600">
            Nothing saved yet. Add something above to start building your clipboard list.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-900">
            {entries.map((entry) => (
              <article key={entry.id} className="px-4 py-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-zinc-600">
                    <ClipboardPaste size={12} />
                    <span>{timestampFormatter.format(new Date(entry.created_at))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onCopyEntry(entry)}
                      disabled={copyingEntryId === entry.id || deletingEntryId === entry.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copyingEntryId === entry.id ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteEntry(entry.id)}
                      disabled={deletingEntryId === entry.id || copyingEntryId === entry.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingEntryId === entry.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Delete
                    </button>
                  </div>
                </div>
                <pre className="m-0 whitespace-pre-wrap break-words font-sans text-sm text-zinc-200">
                  {entry.content}
                </pre>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
