// Voices on the phone: the same online voices as the desktop, each with a sample, and the
// phone's own offline voices that take over when there is no internet.

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic2, Pause, Play, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { api, type VoiceList } from "@/lib/api";
import { Logo } from "@/editor/Logo";
import { deviceVoices } from "../native/voices";
import { useOnline } from "./useOnline";

export function PhoneVoices() {
  const online = useOnline();
  const [list, setList] = useState<VoiceList | null>(null);
  const [offline, setOffline] = useState<Array<{ name: string; language: string; offline: boolean }>>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove("theme-editor");
    api.voices().then(setList).catch(() => setList(null));
    deviceVoices().then(setOffline).catch(() => setOffline([]));
    return () => audio.current?.pause();
  }, []);

  const play = async (id: string) => {
    audio.current?.pause();
    if (playing === id) return setPlaying(null);
    setLoading(id);
    try {
      const url = await api.previewVoice(id);
      const el = new Audio(url);
      el.onended = () => setPlaying(null);
      audio.current = el;
      await el.play();
      setPlaying(id);
    } catch (err) {
      toast.error("Couldn't play the sample", { description: (err as Error).message });
    } finally {
      setLoading(null);
    }
  };

  const languages = [...new Set(offline.filter((v) => v.offline).map((v) => v.language))].sort();

  return (
    <div className="min-h-full bg-background px-4 pb-24 text-foreground" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="flex h-14 items-center">
        <Logo className="h-6" />
      </header>
      <h1 className="mb-1 flex items-center gap-2 font-display text-2xl font-bold">
        <Mic2 className="size-6 text-primary" /> Voices
      </h1>
      <p className="mb-5 text-sm leading-6 text-muted-foreground">Narration uses Microsoft's natural online voices, the same as the desktop studio, with captions timed to every word. With no internet, the phone's own voice reads the line instead.</p>

      {!online && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-xs">
          <WifiOff className="size-4 shrink-0" /> Offline: samples need internet. Videos you build now use the phone's own voice.
        </p>
      )}

      <section className="mb-7">
        <p className="eyebrow mb-2">Online voices</p>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {(list?.edge ?? []).map((v) => (
            <button key={v.id} onClick={() => void play(v.id)} disabled={!online} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-accent disabled:opacity-50">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                {loading === v.id ? <Loader2 className="size-4 animate-spin" /> : playing === v.id ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
              </span>
              <span className="text-[15px]">{v.label}</span>
            </button>
          ))}
          {!list && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
        </div>
      </section>

      <section className="mb-7">
        <p className="eyebrow mb-2">Offline voices on this phone</p>
        {languages.length ? (
          <p className="rounded-xl border border-line bg-panel p-3 text-sm leading-6">
            {languages.length} language{languages.length === 1 ? "" : "s"} available without internet: {languages.slice(0, 12).join(", ")}
            {languages.length > 12 ? "…" : ""}. Add more in Android Settings, Text-to-speech output.
          </p>
        ) : (
          <p className="rounded-xl border border-line bg-panel p-3 text-sm leading-6 text-muted-foreground">The phone's text-to-speech voices appear here in the app. Install more under Android Settings, Text-to-speech output.</p>
        )}
      </section>

      <section>
        <p className="eyebrow mb-2">On the desktop studio</p>
        <p className="rounded-xl border border-line bg-panel p-3 text-sm leading-6 text-muted-foreground">
          The 40 studio voices, voice blends and voice cloning run on a computer, because their models are too large for a phone. Make a clone on the desktop to use it there.
        </p>
      </section>
    </div>
  );
}
