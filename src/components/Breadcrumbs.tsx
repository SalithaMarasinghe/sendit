import React from "react";
import { ChevronRight, Home } from "lucide-react";
import type { Breadcrumb } from "../types";

interface BreadcrumbsProps {
  items: Breadcrumb[];
  onNavigate: (id: string | null) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
      <button
        onClick={() => onNavigate(null)}
        className="p-1 px-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-2 shrink-0"
      >
        <Home size={16} />
        <span className="text-sm font-medium">Root</span>
      </button>

      {items.map((item) => (
        <React.Fragment key={item.id}>
          <ChevronRight size={14} className="text-zinc-600 shrink-0" />
          <button
            onClick={() => onNavigate(item.id)}
            className="p-1 px-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-sm font-medium shrink-0"
          >
            {item.name}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
