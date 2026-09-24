// The phone's home screen: start something new, open a project, and see whether the phone is
// online (editing and export always work; the AI needs internet and your keys).

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Clapperboard, Copy, Film, KeyRound, Layers, Loader2, MoreVertical, Pencil, PlaySquare, Presentation, Smartphone, Trash2, Wand2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api, type ProjectSummary } from "@/lib/api";
import { emptyScene, type Scene } from "@/engine/scene";
import { applyOps } from "@/engine/ops";
import { DEMO_DECK } from "@/home/demoScene";
import { Logo } from "@/editor/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { useOnline } from "./useOnline";

function ago(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}

export function PhoneHome() {
  const navigate = useNavigate();
  const online = useOnline();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  const refresh = () => api.listProjects().then(setProjects).catch(() => setProjects([]));
  useEffect(() => {
    document.documentElement.classList.remove("theme-editor");
    void refresh();
    fetch("/api/health")
      .then((r) => r.json())
      .then((h: { configured?: boolean }) => setAiReady(!!h.configured))
      .catch(() => setAiReady(false));
  }, []);

  const create = async (key: string, title: string, scene: Scene, kind: string, assets: unknown[] = []) => {
    setBusy(key);
    try {
      const { id } = await api.createProject({ title, scene, assets: assets as never, kind });
      navigate(`/editor/${id}`);
    } catch (err) {
      toast.error("Couldn't create the project", { description: (err as Error).message });
      setBusy(null);
    }
  };

  const sample = async () => {
    setBusy("sample");
    try {
      const p = (await (await fetch("/demo/project.json")).json()) as { title: string; scene: Scene; assets: unknown[]; kind?: string };
      await create("sample", p.title, p.scene, p.kind ?? "video", p.assets);
    } catch (err) {
      toast.error("Couldn't open the sample", { description: (err as Error).message });
      setBusy(null);
    }
  };

  const starts = [
    { key: "ai", label: "AI video", blurb: "Idea or script to a finished video", icon: Wand2, tone: "bg-[#f6dccb]", run: () => navigate("/create") },
    { key: "batch", label: "Batch", blurb: "Several videos in one run", icon: Layers, tone: "bg-[#e8e0f3]", run: () => navigate("/batch") },
    { key: "short", label: "Vertical video", blurb: "Blank 9:16 for Shorts and Reels", icon: Smartphone, tone: "bg-[#f3dde4]", run: () => create("short", "Vertical video", emptyScene(1080, 1920), "video") },
    { key: "wide", label: "Landscape video", blurb: "Blank 16:9 for YouTube", icon: Clapperboard, tone: "bg-[#efe6cf]", run: () => create("wide", "Landscape video", emptyScene(1280, 720), "video") },
    { key: "deck", label: "Presentation", blurb: "Narrated slides with illustrations", icon: Presentation, tone: "bg-[#d9efe9]", run: () => create("deck", "Presentation", applyOps(emptyScene(), DEMO_DECK).scene, "presentation") },
    { key: "sample", label: "Sample video", blurb: "A finished AI video to explore", icon: PlaySquare, tone: "bg-[#dfe3f3]", run: sample },
  ];

  return (
    <div className="min-h-full bg-background pb-24 text-foreground" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="flex h-14 items-center justify-between px-4">
        <Logo className="h-6" />
        {!online && (
          <span className="flex items-center gap-1 rounded-full bg-warn/20 px-2.5 py-1 text-[11px] font-medium text-foreground">
            <WifiOff className="size-3.5" /> Offline
          </span>
        )}
      </header>

      {!online && <p className="mx-4 mb-3 rounded-lg border border-line bg-panel px-3 py-2 text-xs leading-5 text-muted-foreground">You're offline. Editing, playback and export all work. The AI, stock footage and online voices come back when you reconnect.</p>}
      {online && aiReady === false && (
        <Link to="/settings" className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs leading-5">
          <KeyRound className="size-4 shrink-0 text-primary" />
          <span>Add your AI key in Settings to write scripts, direct edits and make YouTube packs.</span>
        </Link>
      )}

      <section className="px-4">
        <h1 className="mb-3 font-display text-2xl font-bold">What are we making?</h1>
        <div className="grid grid-cols-2 gap-2.5">
          {starts.map((s) => (
            <button key={s.key} disabled={!!busy} onClick={s.run} className="flex flex-col overflow-hidden rounded-xl border border-line bg-panel text-left active:scale-[0.98]">
              <span className={cn("flex h-16 items-center justify-center", s.tone)}>
                {busy === s.key ? <Loader2 className="size-6 animate-spin" /> : <s.icon className="size-7 opacity-70" strokeWidth={1.6} />}
              </span>
              <span className="p-2.5">
                <span className="block text-[14px] font-semibold leading-tight">{s.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{s.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7 px-4">
        <h2 className="mb-3 font-display text-lg font-semibold">Your projects</h2>
        {projects === null ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Start one above; everything is saved on this phone.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {projects.map((p) => (
              <div key={p.id} className="relative overflow-hidden rounded-xl border border-line bg-panel">
                <button onClick={() => navigate(`/editor/${p.id}`)} className="block w-full text-left">
                  <span className="checker flex aspect-video items-center justify-center overflow-hidden">
                    {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-cover" /> : <Film className="size-6 text-white/40" />}
                  </span>
                  <span className="block px-2.5 pb-2 pt-1.5">
                    <span className="block truncate text-[13px] font-medium">{p.title}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {ago(p.updatedAt)}
                      {p.duration ? ` · ${Math.round(p.duration)}s` : ""}
                      {p.format ? ` · ${p.format}` : ""}
                    </span>
                  </span>
                </button>
                <button className="absolute right-1 top-1 rounded-full bg-black/50 p-1.5 text-white" onClick={() => setMenu(menu === p.id ? null : p.id)} aria-label="Project menu">
                  <MoreVertical className="size-4" />
                </button>
                {menu === p.id && (
                  <div className="absolute right-1 top-9 z-10 w-36 overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm active:bg-accent"
                      onClick={async () => {
                        setMenu(null);
                        const title = prompt("Rename project", p.title);
                        if (title?.trim()) {
                          await api.saveProject(p.id, { title: title.trim() });
                          void refresh();
                        }
                      }}
                    >
                      <Pencil className="size-4" /> Rename
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm active:bg-accent"
                      onClick={async () => {
                        setMenu(null);
                        await api.duplicateProject(p.id);
                        void refresh();
                      }}
                    >
                      <Copy className="size-4" /> Duplicate
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive active:bg-accent"
                      onClick={async () => {
                        setMenu(null);
                        if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
                        await api.deleteProject(p.id);
                        void refresh();
                      }}
                    >
                      <Trash2 className="size-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10">
        <SiteFooter />
      </div>
    </div>
  );
}
