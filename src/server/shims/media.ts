// The phone's media library: the same records the desktop keeps (ids, sizes, lengths, waveforms,
// timeline filmstrips), measured with the web view's own decoders instead of ffmpeg.

import { Buffer } from "buffer";
import { files, isNative, mediaUrlNow, openMedia } from "../../storage/files";

export const DATA_DIR = "studio";
export const MEDIA_DIR = "studio/media";
export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

export type MediaKind = "image" | "video" | "audio" | "svg";

export interface MediaInfo {
  id: string;
  file: string;
  name: string;
  kind: MediaKind;
  mime: string;
  w: number;
  h: number;
  duration?: number;
  hasAudio?: boolean;
  filmstrip?: string;
  frames?: number;
  waveform?: number[];
  origin?: string;
  credit?: string;
  bytes: number;
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".weba": "audio/webm",
  ".opus": "audio/ogg",
};

const extOf = (name: string) => {
  const m = /\.[a-z0-9]{2,5}$/i.exec(name);
  const e = m ? m[0].toLowerCase() : ".bin";
  return e === ".jpeg" ? ".jpg" : e;
};
const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const newId = (prefix: string) => `${prefix}_${hex(6)}`;

// ── Where files live, and the URLs the editor loads them from ───────

/** The URL an editor asset uses for a stored file. */
export function mediaUrl(file: string): string {
  return mediaUrlNow(file) ?? `/api/media/${file}`;
}

/** Saved projects keep "/api/media/<file>", the same as the desktop; this turns one into a loadable URL. */
export function loadableUrl(src: string): string {
  return src.startsWith("/api/media/") ? mediaUrl(src.slice("/api/media/".length)) : src;
}

/** The stored file a loadable URL points at, so it can be saved as "/api/media/<file>". */
export function canonicalUrl(src: string): string {
  if (!src || src.startsWith("/api/media/") || src.startsWith("/") || src.startsWith("data:")) return src;
  const m = /\/((?:img|vid|aud|svg)_[0-9a-f]{12}(?:_strip)?\.[a-z0-9]+)$/i.exec(src);
  if (m) return `/api/media/${m[1]}`;
  // The browser build's blob URLs are looked up by value.
  for (const file of knownBlobFiles()) if (mediaUrlNow(file) === src) return `/api/media/${file}`;
  return src;
}

const blobFiles = new Set<string>();
const knownBlobFiles = () => blobFiles;

/** Open every stored file these assets use, so the browser build can show them. */
export async function prepareUrls(srcs: string[]) {
  const names = srcs.filter((s) => s?.startsWith("/api/media/")).map((s) => s.slice("/api/media/".length));
  if (!isNative) {
    await openMedia(names);
    names.forEach((n) => blobFiles.add(n));
  }
}

async function writeMeta(info: MediaInfo) {
  await files.writeText(`media/${info.id}.json`, JSON.stringify(info));
}

export async function mediaInfo(id: string): Promise<MediaInfo | null> {
  if (!/^[a-z]+_[0-9a-f]{12}$/.test(id)) return null;
  const text = await files.readText(`media/${id}.json`);
  if (!text) return null;
  try {
    const info = JSON.parse(text) as MediaInfo;
    await prepareUrls([`/api/media/${info.file}`, ...(info.filmstrip ? [info.filmstrip] : [])]);
    return { ...info, filmstrip: info.filmstrip ? loadableUrl(info.filmstrip) : undefined };
  } catch {
    return null;
  }
}

/** The stored path of a media item (used where the desktop hands a file to ffmpeg). */
export async function mediaPath(id: string): Promise<string | null> {
  const info = await mediaInfo(id);
  return info ? `media/${info.file}` : null;
}

export async function serveMedia(file: string, _range?: string): Promise<Response> {
  if (!/^[a-z]+_[0-9a-f]{12}(_strip)?\.[a-z0-9]+$/i.test(file)) return new Response("Not found", { status: 404 });
  const bytes = await files.readBytes(`media/${file}`);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes as BodyInit, { headers: { "Content-Type": MIME[extOf(file)] ?? "application/octet-stream" } });
}

export function runFfmpeg(_args?: string[], _timeoutMs?: number): Promise<void> {
  return Promise.reject(new Error("Converting video formats runs in the desktop studio."));
}

// ── Measuring files in the web view ─────────────────────────────────

interface Probe {
  duration: number;
  w: number;
  h: number;
  video: string | null;
  audio: string | null;
  rotation: number;
}

let audioCtx: AudioContext | null = null;
function decoder(): AudioContext {
  audioCtx ??= new AudioContext();
  return audioCtx;
}

async function decodeAudio(bytes: Uint8Array): Promise<AudioBuffer | null> {
  try {
    // decodeAudioData detaches its input, so it gets a copy.
    return await decoder().decodeAudioData(bytes.slice().buffer);
  } catch {
    return null;
  }
}

function peaksOf(buf: AudioBuffer): number[] {
  const data = buf.getChannelData(0);
  const bins = Math.max(50, Math.min(1200, Math.round(buf.duration * 20)));
  const per = Math.max(1, Math.floor(data.length / bins));
  const peaks: number[] = [];
  let max = 1e-6;
  for (let b = 0; b < bins; b++) {
    let peak = 0;
    const end = Math.min(data.length, (b + 1) * per);
    for (let i = b * per; i < end; i += 4) peak = Math.max(peak, Math.abs(data[i]));
    peaks.push(peak);
    max = Math.max(max, peak);
  }
  return peaks.map((p) => Math.round((p / max) * 100) / 100);
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    const done = () => resolve(v);
    v.addEventListener("loadeddata", done, { once: true });
    v.addEventListener("error", () => reject(new Error("This video format can't be played on this phone. Convert it to MP4 (H.264) first.")), { once: true });
    setTimeout(() => (v.readyState >= 1 ? done() : reject(new Error("The video took too long to open"))), 20_000);
    v.src = url;
  });
}

/** Size and length of any stored file. */
export async function probe(path: string): Promise<Probe> {
  const url = await files.url(path);
  const ext = extOf(path);
  if (MIME[ext]?.startsWith("audio/")) {
    const bytes = await files.readBytes(path);
    const buf = bytes ? await decodeAudio(bytes) : null;
    return { duration: buf?.duration ?? 0, w: 0, h: 0, video: null, audio: buf ? "audio" : null, rotation: 0 };
  }
  const v = await loadVideo(url);
  const out = { duration: Number.isFinite(v.duration) ? v.duration : 0, w: v.videoWidth, h: v.videoHeight, video: v.videoWidth ? "video" : null, audio: "audio", rotation: 0 };
  v.removeAttribute("src");
  v.load();
  return out;
}

/** A strip of small frames across a clip, for the timeline (the desktop makes the same with ffmpeg). */
async function makeFilmstrip(info: MediaInfo, url: string) {
  const frames = Math.max(4, Math.min(12, Math.round((info.duration ?? 4) / 2)));
  const v = await loadVideo(url);
  const w = 160;
  const h = Math.max(2, Math.round((w * info.h) / Math.max(1, info.w) / 2) * 2);
  const canvas = document.createElement("canvas");
  canvas.width = w * frames;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const dur = info.duration ?? 4;
  for (let i = 0; i < frames; i++) {
    const t = Math.min(dur - 0.05, (dur * (i + 0.5)) / frames);
    await new Promise<void>((r) => {
      const next = () => r();
      v.addEventListener("seeked", next, { once: true });
      setTimeout(next, 1500);
      v.currentTime = Math.max(0, t);
    });
    ctx.drawImage(v, i * w, 0, w, h);
  }
  v.removeAttribute("src");
  v.load();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.6));
  if (!blob) return;
  const file = `${info.id}_strip.jpg`;
  await files.writeBytes(`media/${file}`, new Uint8Array(await blob.arrayBuffer()));
  await prepareUrls([`/api/media/${file}`]);
  info.filmstrip = `/api/media/${file}`;
  info.frames = frames;
}

/** Pictures larger than a video ever needs are scaled down, like the desktop does. */
async function shrinkImage(bytes: Uint8Array, ext: string): Promise<{ bytes: Uint8Array; w: number; h: number; ext: string }> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
  const MAX = 2560;
  let { width: w, height: h } = bitmap;
  if (Math.max(w, h) <= MAX || ext === ".gif") {
    bitmap.close();
    return { bytes, w, h, ext };
  }
  const k = MAX / Math.max(w, h);
  w = Math.round((w * k) / 2) * 2;
  h = Math.round((h * k) / 2) * 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const outExt = ext === ".png" ? ".png" : ".jpg";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, outExt === ".png" ? "image/png" : "image/jpeg", 0.9));
  return { bytes: blob ? new Uint8Array(await blob.arrayBuffer()) : bytes, w, h, ext: outExt };
}

export async function importMedia(input: Buffer | Uint8Array, originalName: string, opts: { origin?: string; credit?: string } = {}): Promise<MediaInfo> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > MAX_UPLOAD_BYTES) throw new Error("That file is over 300 MB.");
  let ext = extOf(originalName);
  const name = originalName.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || "media";
  const head = new TextDecoder().decode(bytes.subarray(0, 512));

  // SVG drawings.
  if (ext === ".svg" || head.includes("<svg")) {
    const id = newId("svg");
    const file = `${id}.svg`;
    await files.writeBytes(`media/${file}`, bytes);
    const vb = new TextDecoder().decode(bytes).match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1]?.split(/[\s,]+/).map(Number);
    const info: MediaInfo = { id, file, name, kind: "svg", mime: MIME[".svg"], w: vb?.[2] || 400, h: vb?.[3] || 400, bytes: bytes.length, ...opts };
    await writeMeta(info);
    await prepareUrls([`/api/media/${file}`]);
    return info;
  }

  // Pictures.
  const sniffImage = /^(\x89PNG|\xff\xd8\xff|GIF8|RIFF....WEBP)/.test(Buffer.from(bytes.subarray(0, 12)).toString("latin1"));
  if ([".png", ".jpg", ".webp", ".gif"].includes(ext) || sniffImage) {
    if (ext === ".bin") ext = ".png";
    const img = await shrinkImage(bytes, ext);
    const id = newId("img");
    const file = `${id}${img.ext}`;
    await files.writeBytes(`media/${file}`, img.bytes);
    const info: MediaInfo = { id, file, name, kind: "image", mime: MIME[img.ext] ?? "image/png", w: img.w, h: img.h, bytes: img.bytes.length, ...opts };
    await writeMeta(info);
    await prepareUrls([`/api/media/${file}`]);
    return info;
  }

  // Sound files.
  if (MIME[ext]?.startsWith("audio/")) {
    const buf = await decodeAudio(bytes);
    if (!buf) throw new Error("That sound file can't be played on this phone. MP3, WAV or M4A work everywhere.");
    const id = newId("aud");
    const file = `${id}${ext === ".webm" ? ".weba" : ext}`;
    await files.writeBytes(`media/${file}`, bytes);
    const info: MediaInfo = { id, file, name, kind: "audio", mime: MIME[ext] ?? "audio/mpeg", w: 0, h: 0, duration: buf.duration, hasAudio: true, waveform: peaksOf(buf), bytes: bytes.length, ...opts };
    await writeMeta(info);
    await prepareUrls([`/api/media/${file}`]);
    return info;
  }

  // Video (or audio in a video container).
  const tmpId = newId("vid");
  const file = `${tmpId}${ext === ".m4v" || ext === ".bin" ? ".mp4" : ext}`;
  await files.writeBytes(`media/${file}`, bytes);
  await prepareUrls([`/api/media/${file}`]);
  try {
    const url = mediaUrl(file);
    const v = await loadVideo(url);
    const w = v.videoWidth;
    const h = v.videoHeight;
    const duration = Number.isFinite(v.duration) ? v.duration : 0;
    v.removeAttribute("src");
    v.load();
    // Decoding the sound tells us whether there is any, and gives the waveform.
    const sound = bytes.length < 80 * 1024 * 1024 ? await decodeAudio(bytes) : null;
    if (!w) {
      if (!sound) throw new Error("That file isn't a picture, video or sound this editor can use.");
      const info: MediaInfo = { id: tmpId.replace("vid_", "aud_"), file, name, kind: "audio", mime: MIME[ext] ?? "audio/mpeg", w: 0, h: 0, duration, hasAudio: true, waveform: peaksOf(sound), bytes: bytes.length, ...opts };
      // Keep the id and file name in step for the audio record.
      const audioFile = file.replace("vid_", "aud_");
      await files.writeBytes(`media/${audioFile}`, bytes);
      await files.remove(`media/${file}`);
      info.file = audioFile;
      await writeMeta(info);
      await prepareUrls([`/api/media/${audioFile}`]);
      return info;
    }
    const info: MediaInfo = { id: tmpId, file, name, kind: "video", mime: MIME[ext] ?? "video/mp4", w, h, duration, hasAudio: !!sound || bytes.length >= 80 * 1024 * 1024, bytes: bytes.length, ...opts };
    if (sound) info.waveform = peaksOf(sound);
    await makeFilmstrip(info, url).catch(() => {});
    await writeMeta(info);
    return { ...info, filmstrip: info.filmstrip ? loadableUrl(info.filmstrip) : undefined };
  } catch (err) {
    await files.remove(`media/${file}`);
    throw err;
  }
}
