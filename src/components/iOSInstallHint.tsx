import { useState, useEffect } from "react";
import { Share, PlusSquare, X } from "lucide-react";

export function IOSInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if it's iOS and not already in standalone mode
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    if (isiOS && !isStandalone) {
      // Show hint if not dismissed before
      const isDismissed = localStorage.getItem("ios_install_hint_dismissed");
      if (!isDismissed) {
        setShow(true);
      }
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-start gap-4 ring-1 ring-zinc-100/10">
        <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center shrink-0">
          <img src="/pwa-192x192.png" alt="Sendit" className="w-10 h-10 rounded-lg shadow-sm" />
        </div>
        
        <div className="flex-1 pt-0.5">
          <h4 className="text-sm font-bold text-zinc-100 mb-1">Install Sendit App</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Tap the <Share size={14} className="inline-block mx-0.5 text-zinc-100" /> button and then <span className="text-zinc-100 font-semibold">'Add to Home Screen'</span> <PlusSquare size={14} className="inline-block mx-0.5 text-zinc-100" /> for a premium full-screen experience.
          </p>
        </div>

        <button 
          onClick={() => {
            setShow(false);
            localStorage.setItem("ios_install_hint_dismissed", "true");
          }}
          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      
      {/* Little arrow at the bottom center pointing down to Safari share button */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-zinc-900 border-r border-b border-zinc-800 rotate-45" />
    </div>
  );
}
