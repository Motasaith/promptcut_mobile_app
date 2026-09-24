// A bottom sheet for the editor's panels: slides up over the timeline, closes on a tap outside
// or on the handle, and gives the studio panel inside a fixed height to scroll within.

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title: string; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-50 transition", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div className={cn("absolute inset-0 bg-black/50 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <section
        role="dialog"
        aria-label={title}
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl border-t border-line bg-panel shadow-2xl transition-transform duration-200",
          tall ? "h-[82vh]" : "h-[62vh]",
          open ? "translate-y-0" : "translate-y-full"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/40" onClick={onClose} aria-label="Close" />
        <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-2">
          <p className="font-display text-[15px] font-semibold">{title}</p>
          <button className="rounded-full p-2 text-muted-foreground active:bg-accent" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{open && children}</div>
      </section>
    </div>
  );
}
