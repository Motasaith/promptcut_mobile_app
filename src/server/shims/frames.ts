// Image work for the AI footage checks, on the phone: contact sheets of candidate thumbnails
// (curate.ts) and real frames of finished scenes (review.ts), drawn with the web view's canvas
// and the studio's own frame renderer instead of Node's canvas and ffmpeg.

import type { Asset, Scene } from "@/engine/scene";
import { renderStill } from "@/export";
import type { MediaItem } from "@server/sources";

async function picture(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

function numbered(images: Array<CanvasImageSource & { width: number; height: number }>, cols: number, cw: number, ch: number, labels: number[]): string {
  const rows = Math.ceil(images.length / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cols * cw;
  canvas.height = rows * ch;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  images.forEach((img, k) => {
    const x = (k % cols) * cw;
    const y = Math.floor(k / cols) * ch;
    const s = Math.max(cw / img.width, ch / img.height);
    const w = img.width * s;
    const h = img.height * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cw, ch);
    ctx.clip();
    ctx.drawImage(img, x + (cw - w) / 2, y + (ch - h) / 2, w, h);
    ctx.restore();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, cw, ch);
    ctx.fillStyle = "#e11d48";
    ctx.fillRect(x + 6, y + 6, 42, 32);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(labels[k]), x + 27, y + 22);
  });
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** A numbered grid of candidate thumbnails. Null when fewer than two load. */
export async function contactSheet(items: MediaItem[], portrait: boolean): Promise<{ url: string; shown: number[] } | null> {
  const loaded = await Promise.all(items.map((it) => (it.thumbnail ? picture(it.thumbnail) : Promise.resolve(null))));
  const shown: number[] = [];
  const images: ImageBitmap[] = [];
  loaded.forEach((img, i) => {
    if (!img) return;
    images.push(img);
    shown.push(i);
  });
  if (shown.length < 2) return null;
  const [cw, ch] = portrait ? [180, 320] : [320, 180];
  const url = numbered(images, 4, cw, ch, images.map((_, k) => k + 1));
  images.forEach((i) => i.close());
  return { url, shown };
}

/** One rendered frame per time, exactly as the export draws it, tiled and numbered. */
export async function sceneSheet(scene: Scene, assets: Asset[], times: number[], labels: number[]): Promise<string | null> {
  const frames: HTMLCanvasElement[] = [];
  for (const t of times) {
    try {
      frames.push(await renderStill(scene, assets, t));
    } catch {
      return null;
    }
  }
  const portrait = scene.height > scene.width;
  return numbered(frames, portrait ? 4 : 3, portrait ? 200 : 360, portrait ? 356 : 202, labels);
}
