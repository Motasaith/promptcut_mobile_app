// Handing a finished video to the user on the phone: it is written to the app cache in slices
// and opened in Android's share sheet (Save to Files, Google Photos, YouTube, WhatsApp...).
// A copy also goes to Documents/PromptCut where the phone allows it.

import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Buffer } from "buffer";
import { toast } from "sonner";
import { isNative } from "../storage/files";

const SLICE = 3 * 1024 * 1024;

async function writeSlices(path: string, directory: Directory, blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  for (let at = 0; at < Math.max(1, bytes.length); at += SLICE) {
    const data = Buffer.from(bytes.subarray(at, at + SLICE)).toString("base64");
    if (at === 0) await Filesystem.writeFile({ path, data, directory, recursive: true });
    else await Filesystem.appendFile({ path, data, directory });
  }
}

function browserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function saveAndShare(blob: Blob, filename: string) {
  if (!isNative) return browserDownload(blob, filename);
  const safe = filename.replace(/[^\w.\- ]+/g, "_");
  try {
    await writeSlices(`exports/${safe}`, Directory.Cache, blob);
    // A permanent copy where the phone lets apps write (not every phone does; the share sheet always works).
    let savedTo = "";
    try {
      await writeSlices(`PromptCut/${safe}`, Directory.Documents, blob);
      savedTo = "Saved in Documents/PromptCut.";
    } catch {
      savedTo = "";
    }
    const { uri } = await Filesystem.getUri({ path: `exports/${safe}`, directory: Directory.Cache });
    if (savedTo) toast.success("Video saved", { description: savedTo });
    await Share.share({ title: safe, files: [uri], dialogTitle: "Save or share your video" });
  } catch (err) {
    // Closing the share sheet without picking anything is not an error.
    if (/cancel/i.test(String((err as Error).message))) return;
    toast.error("Couldn't save the video", { description: (err as Error).message });
  }
}
