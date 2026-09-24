// Transcribing recordings uses Whisper, which runs in the desktop studio for now.

export const MAX_TRANSCRIBE_SEC = 15 * 60;

export const SPEECH_LANGUAGES = [
  "english", "urdu", "hindi", "arabic", "punjabi", "bengali", "persian", "turkish", "indonesian", "malay",
  "spanish", "french", "german", "portuguese", "italian", "russian", "chinese", "japanese", "korean",
] as const;
export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number];

export function transcribe(_file: string, _language: SpeechLanguage, _from = 0, _to: number | null = null): Promise<Array<{ start: number; end: number; text: string }>> {
  return Promise.reject(new Error("Turning a recording into text runs in the desktop studio for now. On the phone, write or paste the script and pick a voice."));
}
