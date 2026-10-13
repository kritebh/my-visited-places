"use client";

import { useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

/** Bottom sheet on mobile (swipe down to close), right-hand panel on desktop. */
export function Sheet({ title, subtitle, onClose, children }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const dragHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      startY.current = e.touches[0].clientY;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (startY.current === null) return;
      setDragY(Math.max(0, e.touches[0].clientY - startY.current));
    },
    onTouchEnd: () => {
      if (dragY > 90) onClose();
      startY.current = null;
      setDragY(0);
    },
  };

  return (
    <aside
      className="absolute z-20 inset-x-0 bottom-0 max-h-[62%] md:inset-y-3 md:right-3 md:left-auto md:bottom-3 md:max-h-none md:w-96 flex flex-col rounded-t-3xl md:rounded-2xl border border-line bg-surface shadow-2xl"
      style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : { transition: "transform 150ms" }}
      role="dialog"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div {...dragHandlers} className="touch-none md:touch-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" />
        <header className="flex items-start gap-3 px-4 pt-3 pb-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight truncate">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-ink-2">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="-m-1 rounded-full p-2.5 text-muted hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </header>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
    </aside>
  );
}
