// The editor on a phone: canvas and playback on top, the real timeline below, and a scrolling
// tool bar that opens each studio panel (media, stock, text, art, AI Director, properties...)
// in a bottom sheet. Every panel is the studio's own; only the layout is new.

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Box, Clapperboard, Download, Globe2, Mic, Music, PawPrint, Presentation, Redo2, Shapes, SlidersHorizontal, Smile, Sparkles, Type, Undo2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore, type LeftTab } from "@/store";
import { Stage } from "@/editor/Stage";
import { Timeline } from "@/editor/Timeline";
import { ExportDialog } from "@/editor/ExportDialog";
import { AiTools } from "@/editor/AiTools";
import { AIPanel } from "@/editor/right/AIPanel";
import { Inspector } from "@/editor/right/Inspector";
import { MediaTab } from "@/editor/left/MediaTab";
import { StockTab } from "@/editor/left/StockTab";
import { TextTab } from "@/editor/left/TextTab";
import { StickersTab } from "@/editor/left/StickersTab";
import { IllustrationsTab } from "@/editor/left/IllustrationsTab";
import { ShapesTab } from "@/editor/left/ShapesTab";
import { CharactersTab } from "@/editor/left/CharactersTab";
import { PropsTab } from "@/editor/left/PropsTab";
import { EffectsTab } from "@/editor/left/EffectsTab";
import { SoundsTab } from "@/editor/left/SoundsTab";
import { SlidesTab } from "@/editor/left/SlidesTab";
import { RecordTab } from "@/editor/left/RecordTab";
import { Sheet } from "./Sheet";

type Tool = { id: string; label: string; icon: typeof Box; panel: ComponentType; ai?: boolean; tall?: boolean };

const LEFT: Array<Tool & { id: LeftTab }> = [
  { id: "media", label: "Media", icon: Clapperboard, panel: MediaTab },
  { id: "stock", label: "Stock", icon: Globe2, panel: StockTab, ai: true },
  { id: "slides", label: "Slides", icon: Presentation, panel: SlidesTab },
  { id: "text", label: "Text", icon: Type, panel: TextTab },
  { id: "illustrations", label: "Art", icon: Wand2, panel: IllustrationsTab, ai: true },
  { id: "stickers", label: "Stickers", icon: Smile, panel: StickersTab },
  { id: "shapes", label: "Shapes", icon: Shapes, panel: ShapesTab },
  { id: "characters", label: "People", icon: PawPrint, panel: CharactersTab, ai: true },
  { id: "props", label: "3D", icon: Box, panel: PropsTab },
  { id: "effects", label: "Effects", icon: Sparkles, panel: EffectsTab },
  { id: "sounds", label: "Sounds", icon: Music, panel: SoundsTab, ai: true },
  { id: "record", label: "Record", icon: Mic, panel: RecordTab },
];
const AI: Tool = { id: "ai", label: "AI Director", icon: Wand2, panel: AIPanel, ai: true, tall: true };
const EDIT: Tool = { id: "edit", label: "Edit", icon: SlidersHorizontal, panel: Inspector, tall: true };
const ALL: Tool[] = [AI, EDIT, ...LEFT];

export function PhoneWorkspace({ className }: { className?: string }) {
  const navigate = useNavigate();
  const title = useStore((s) => s.title);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const selected = useStore((s) => s.selectedId);
  const leftTab = useStore((s) => s.leftTab);
  const mode = useStore((s) => s.mode);
  const [open, setOpen] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const first = useRef(true);
  /** Set when a tool button changed the mode itself, so the mode effect leaves the sheet alone. */
  const ownChange = useRef(false);

  // The AI tools menu and the studio's own panels switch tabs through the store: follow them.
  useEffect(() => {
    if (first.current) return;
    setOpen(leftTab);
  }, [leftTab]);
  // Adding something switches the studio to "edit": on a phone, close the sheet so the new item
  // is visible (the Edit selected button opens its properties). "ai" opens the AI Director.
  useEffect(() => {
    if (first.current) return;
    if (ownChange.current) {
      ownChange.current = false;
      return;
    }
    setOpen(mode === "ai" ? "ai" : null);
  }, [mode]);
  // The AI tools menu jumps to a properties section (YouTube kit, intros): open Edit for it.
  useEffect(() => {
    const show = () => setOpen("edit");
    window.addEventListener("stickman-open-section", show);
    return () => window.removeEventListener("stickman-open-section", show);
  }, []);
  useEffect(() => {
    first.current = false;
  }, []);

  const tool = ALL.find((t) => t.id === open) ?? null;
  const Panel = tool?.panel;
  const openTool = (t: Tool) => {
    const s = useStore.getState();
    if ((t.id === "ai" || t.id === "edit") && s.mode !== t.id) {
      ownChange.current = true;
      s.setMode(t.id);
    } else if (t.id !== "ai" && t.id !== "edit") s.setLeftTab(t.id as LeftTab);
    setOpen(t.id);
  };

  return (
    <div className={cn("flex flex-col overflow-hidden bg-background", className)} style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)" }}>
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-panel px-1.5">
        <button className="rounded-full p-2.5 active:bg-accent" onClick={() => navigate("/")} aria-label="All projects">
          <ArrowLeft className="size-5" />
        </button>
        <p className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold">{title}</p>
        <button className="rounded-full p-2.5 disabled:opacity-30 active:bg-accent" disabled={!canUndo} onClick={() => useStore.getState().undo()} aria-label="Undo">
          <Undo2 className="size-[18px]" />
        </button>
        <button className="rounded-full p-2.5 disabled:opacity-30 active:bg-accent" disabled={!canRedo} onClick={() => useStore.getState().redo()} aria-label="Redo">
          <Redo2 className="size-[18px]" />
        </button>
        <div className="scale-90">
          <AiTools />
        </div>
        <button className="ml-0.5 flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground active:opacity-80" onClick={() => setExportOpen(true)}>
          <Download className="size-4" /> Export
        </button>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col">
        <Stage />
        {selected && !open && (
          <button className="absolute bottom-16 right-3 z-10 flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-lg" onClick={() => openTool(EDIT)}>
            <SlidersHorizontal className="size-4" /> Edit selected
          </button>
        )}
      </main>

      <section className="h-[30vh] min-h-[170px] shrink-0 border-t border-line bg-panel">
        <Timeline />
      </section>

      <nav className="flex shrink-0 gap-1 overflow-x-auto border-t border-line bg-panel px-2 py-1.5" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
        {ALL.map((t) => (
          <button
            key={t.id}
            onClick={() => openTool(t)}
            className={cn("relative flex min-w-[60px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] active:bg-accent", open === t.id ? "bg-panel-raised text-foreground" : "text-muted-foreground")}
          >
            <t.icon className={cn("size-5", (open === t.id || t.id === "ai") && "text-primary")} />
            {t.label}
            {t.ai && t.id !== "ai" && <Sparkles aria-hidden className="absolute right-2 top-1 size-2.5 text-primary" />}
          </button>
        ))}
      </nav>

      <Sheet open={!!tool} onClose={() => setOpen(null)} title={tool?.label ?? ""} tall={tool?.tall}>
        {Panel && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Panel />
          </div>
        )}
      </Sheet>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
