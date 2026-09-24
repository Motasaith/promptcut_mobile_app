// Studio voices (Kokoro), blends and clones need the desktop's voice models, which are too heavy
// for a phone. The phone uses the online Edge voices, or Android's own voices offline.

import type { SpokenWord } from "./tts";

const DESKTOP_ONLY = "Studio voices, blends and cloned voices run in the desktop studio. On the phone, pick one of the online voices.";

export async function engineVoiceFor(_ref: string): Promise<{ voice: never; label: string }> {
  throw new Error(DESKTOP_ONLY);
}

export async function speakLocal(_text: string, _ref: string, _onProgress?: (p: number, stage: string) => void): Promise<{ audio: Uint8Array; ext: ".wav"; words: SpokenWord[]; duration: number }> {
  throw new Error(DESKTOP_ONLY);
}

export const REALTIME_FACTOR = { edge: 0.05, kokoro: 3, clone: 63 } as const;
