// The two native voice plugins (android/app/src/main/java/com/promptcut/mobile):
// EdgeVoice speaks with Microsoft Edge's online neural voices, the same ones the desktop uses,
// and returns word timings for captions. DeviceVoice uses Android's own text to speech, which
// works with no internet at all.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { Buffer } from "buffer";

interface EdgeVoicePlugin {
  speak(opts: { text: string; voice: string; rate: string; pitch: string }): Promise<{ audio: string; words: Array<{ start: number; end: number; text: string }> }>;
}
interface DeviceVoicePlugin {
  synthesize(opts: { text: string; language: string; male: boolean; rate: number; pitch: number }): Promise<{ audio: string }>;
  voices(): Promise<{ voices: Array<{ name: string; language: string; offline: boolean }> }>;
}

const EdgeVoice = registerPlugin<EdgeVoicePlugin>("EdgeVoice");
const DeviceVoice = registerPlugin<DeviceVoicePlugin>("DeviceVoice");

export const nativeVoices = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export async function edgeLine(text: string, voice: string, rate: string, pitch: string) {
  const r = await EdgeVoice.speak({ text, voice, rate, pitch });
  return { audio: new Uint8Array(Buffer.from(r.audio, "base64")), words: r.words };
}

export async function deviceLine(text: string, language: string, male: boolean, rate = 1, pitch = 1) {
  const r = await DeviceVoice.synthesize({ text, language, male, rate, pitch });
  return new Uint8Array(Buffer.from(r.audio, "base64"));
}

export async function deviceVoices() {
  return nativeVoices ? (await DeviceVoice.voices()).voices : [];
}
