// GIF, MP3 and cover conversions use ffmpeg, which runs in the desktop studio.
// The phone exports the video itself (MP4, or WebM where the phone can't encode MP4).

import type { Buffer } from "buffer";

export const EXPORT_FORMATS = ["mp4", "gif", "mp3", "cover"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const MAX_GIF_SECONDS = 20;

export interface ConvertOptions {
  format: ExportFormat;
  start?: number;
  end?: number;
  fps?: 24 | 25 | 30 | 60;
  size?: "small" | "full";
  at?: number;
}

export async function convertExport(_input: Buffer, _o: ConvertOptions): Promise<{ bytes: Buffer; ext: string; mime: string }> {
  throw new Error("GIF, sound-only and cover exports run in the desktop studio. The phone exports the video itself.");
}
