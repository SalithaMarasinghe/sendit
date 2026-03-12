import React, { useState } from "react";
import { unlock } from "../api";
import { Lock, ArrowRight, Loader2 } from "lucide-react";

interface AuthGateProps {
  onUnlock: () => void;
}

export function AuthGate({ onUnlock }: AuthGateProps) {
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;

    setIsLoading(true);
    setError("");

    try {
      await unlock(passcode);
      onUnlock();
    } catch (err: any) {
      setError(err.message || "Invalid passcode");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 border border-zinc-700">
            <Lock className="text-zinc-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Sendit</h1>
          <p className="text-zinc-500 text-center">
            Enter the shared secret to access your files
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              placeholder="Passcode"
              className="w-full bg-zinc-800 border-zinc-700 text-foreground rounded-xl px-4 py-3 focus:ring-2 focus:ring-zinc-600 focus:border-transparent outline-none transition-all placeholder:text-zinc-600"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-rose-500 text-sm bg-rose-500/10 py-2 px-3 rounded-lg border border-rose-500/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !passcode}
            className="w-full bg-foreground text-background font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Unlock <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-zinc-600 text-xs text-center leading-relaxed">
          Your personal cross-device file manager. v1.2.2<br />
          Built with Cloudflare R2 + D1.
        </p>
      </div>
    </div>
  );
}
