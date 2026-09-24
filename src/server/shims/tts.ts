// Spoken lines on the phone. Online: Microsoft Edge's neural voices through the native EdgeVoice
// plugin, with real word timings, exactly like the desktop. Offline, or if Edge can't be reached:
// Android's own voice for the same language and gender, with word timings spread by length.

import { Buffer } from "buffer";
import { VOICES } from "@/engine/voices";
import { estimateWords } from "@/engine/media";
import type { VoiceId } from "@/engine/scene";
import { deviceLine, edgeLine, nativeVoices } from "../../native/voices";

const DASH = new RegExp(`\\s*[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]\\s*`, "g");

export function cleanForSpeech(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(DASH, ", ")
    .replace(/[*_`#]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface SpokenWord {
  start: number;
  end: number;
  text: string;
}

const FEMALE = new Set<VoiceId>(["woman", "girl", "oldWoman", "urduWoman", "cat", "bird"]);

/** Seconds of sound in a 16-bit PCM WAV. */
function wavSeconds(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rate = view.getUint32(24, true);
  const channels = view.getUint16(22, true);
  const bits = view.getUint16(34, true);
  let at = 12;
  while (at + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(at, at + 4));
    const size = view.getUint32(at + 4, true);
    if (id === "data") return size / (rate * channels * (bits / 8));
    at += 8 + size;
  }
  return 0;
}

/** A silent WAV of a given length: only for the browser test build, which has no voices. */
function silence(seconds: number): Uint8Array {
  const rate = 8000;
  const n = Math.max(1, Math.round(seconds * rate));
  const buf = new Uint8Array(44 + n * 2);
  const v = new DataView(buf.buffer);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => (buf[o + i] = c.charCodeAt(0)));
  tag(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  tag(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, n * 2, true);
  return buf;
}

const languageOf = (edge: string) => edge.split("-").slice(0, 2).join("-");

export async function speakWithWords(text: string, voice: VoiceId): Promise<{ mp3: Buffer; words: SpokenWord[] }> {
  const v = VOICES[voice] ?? VOICES.man;
  const clean = cleanForSpeech(text);
  if (!clean) throw new Error("Nothing to say");
  if (!nativeVoices) {
    const seconds = Math.max(1, clean.split(/\s+/).length / 2.6);
    return { mp3: Buffer.from(silence(seconds)), words: estimateWords(clean, 0, seconds) };
  }
  if (navigator.onLine) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // The last attempt drops pitch, which some voices reject (as on the desktop).
        const r = await edgeLine(clean, v.edge, v.rate, attempt < 3 ? v.pitch : "+0Hz");
        if (r.audio.length > 100) return { mp3: Buffer.from(r.audio), words: r.words };
      } catch (err) {
        lastError = err;
      }
    }
    console.warn(`[voice] online voice failed, using the phone's own voice: ${String(lastError)}`);
  }
  const wav = await deviceLine(clean, languageOf(v.edge), !FEMALE.has(voice));
  return { mp3: Buffer.from(wav), words: estimateWords(clean, 0, wavSeconds(wav)) };
}

export async function speak(text: string, voice: VoiceId): Promise<Buffer> {
  return (await speakWithWords(text, voice)).mp3;
}
