// The phone's own versions of the few desktop routes that depend on the computer: the voice
// list (online voices instead of local models), voice samples, job status, and the export
// finishing step (the phone keeps the file as the editor made it).

import { Hono } from "hono";
import { z } from "zod";
import { VOICE_IDS, isLocalVoice, type VoiceId } from "@/engine/scene";
import { VOICES } from "@/engine/voices";
import { getJob } from "@server/jobs";
import { speakWithWords } from "./shims/tts";
import { REALTIME_FACTOR } from "./shims/voicesLocal";

export const phoneRoutes = new Hono();

const DESKTOP_ONLY = "Studio voices, blends and cloned voices are made in the desktop studio. On the phone, pick one of the online voices.";
const PREVIEW_TEXT = "Here's the thing nobody tells you. The story you think you know is only half of it.";
const previews = new Map<string, Uint8Array>();

phoneRoutes.get("/api/voices", (c) =>
  c.json({
    edge: VOICE_IDS.filter((id) => !["dog", "cat", "bird"].includes(id)).map((id) => ({ id, label: VOICES[id].label })),
    studio: [],
    presets: [],
    saved: [],
    installed: { studio: false, clone: false },
    realtime: REALTIME_FACTOR,
  })
);

phoneRoutes.post("/api/voices/preview", async (c) => {
  const body = z.object({ voice: z.string().max(60), text: z.string().max(300).optional(), blend: z.array(z.unknown()).optional() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Bad request" }, 400);
  if (isLocalVoice(body.data.voice) || body.data.blend) return c.json({ error: DESKTOP_ONLY }, 400);
  if (!(VOICE_IDS as readonly string[]).includes(body.data.voice)) return c.json({ error: "Unknown voice" }, 400);
  const text = body.data.text?.trim() || PREVIEW_TEXT;
  const key = `${body.data.voice}|${text}`;
  try {
    let audio = previews.get(key);
    if (!audio) {
      audio = new Uint8Array((await speakWithWords(text, body.data.voice as VoiceId)).mp3);
      previews.set(key, audio);
    }
    const wav = audio[0] === 0x52 && audio[1] === 0x49; // "RI" of RIFF
    return new Response(audio as BodyInit, { headers: { "Content-Type": wav ? "audio/wav" : "audio/mpeg" } });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});

for (const path of ["/api/voices/blend", "/api/voices/clone", "/api/voices/install"]) phoneRoutes.post(path, (c) => c.json({ error: DESKTOP_ONLY }, 400));
phoneRoutes.delete("/api/voices/:id", (c) => c.json({ error: DESKTOP_ONLY }, 400));

phoneRoutes.get("/api/jobs/:id", (c) => {
  const job = getJob(c.req.param("id"));
  return job ? c.json(job) : c.json({ error: "That job isn't running any more." }, 404);
});

/**
 * The desktop re-encodes an Opus sound track as AAC with ffmpeg here. The phone declines, so the
 * editor keeps its file (and its real format) and tells the user which players handle it.
 */
phoneRoutes.post("/api/export/finalize", (c) => c.json({ error: "sound conversion runs in the desktop studio" }, 501));
