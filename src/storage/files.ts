// Where the phone keeps projects, media and settings: the app's private data folder on Android
// (Capacitor Filesystem), or IndexedDB when the same build runs in a desktop browser for testing.
// Nothing here needs the internet.

import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Buffer } from "buffer";

export const isNative = Capacitor.isNativePlatform();
const ROOT = "studio";

/** Bytes are written to disk in slices so a large video never crosses the bridge in one piece. */
const SLICE = 3 * 1024 * 1024; // a multiple of 3, so every slice is whole base64

interface Backend {
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  readBytes(path: string): Promise<Uint8Array | null>;
  writeText(path: string, text: string): Promise<void>;
  readText(path: string): Promise<string | null>;
  list(dir: string): Promise<string[]>;
  remove(path: string): Promise<void>;
  removeDir(dir: string): Promise<void>;
  /** A URL an <img>, <video> or fetch() can load. */
  url(path: string): Promise<string>;
}

const nativeBackend: Backend = {
  async writeBytes(path, data) {
    const full = `${ROOT}/${path}`;
    for (let at = 0; at < Math.max(1, data.length); at += SLICE) {
      const chunk = Buffer.from(data.subarray(at, at + SLICE)).toString("base64");
      if (at === 0) await Filesystem.writeFile({ path: full, data: chunk, directory: Directory.Data, recursive: true });
      else await Filesystem.appendFile({ path: full, data: chunk, directory: Directory.Data });
    }
  },
  async readBytes(path) {
    try {
      const r = await Filesystem.readFile({ path: `${ROOT}/${path}`, directory: Directory.Data });
      return typeof r.data === "string" ? new Uint8Array(Buffer.from(r.data, "base64")) : new Uint8Array(await (r.data as Blob).arrayBuffer());
    } catch {
      return null;
    }
  },
  async writeText(path, text) {
    await Filesystem.writeFile({ path: `${ROOT}/${path}`, data: text, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
  },
  async readText(path) {
    try {
      const r = await Filesystem.readFile({ path: `${ROOT}/${path}`, directory: Directory.Data, encoding: Encoding.UTF8 });
      return typeof r.data === "string" ? r.data : await (r.data as Blob).text();
    } catch {
      return null;
    }
  },
  async list(dir) {
    try {
      const r = await Filesystem.readdir({ path: `${ROOT}/${dir}`, directory: Directory.Data });
      return r.files.filter((f) => f.type === "file").map((f) => f.name);
    } catch {
      return [];
    }
  },
  async remove(path) {
    await Filesystem.deleteFile({ path: `${ROOT}/${path}`, directory: Directory.Data }).catch(() => {});
  },
  async removeDir(dir) {
    await Filesystem.rmdir({ path: `${ROOT}/${dir}`, directory: Directory.Data, recursive: true }).catch(() => {});
  },
  async url(path) {
    const { uri } = await Filesystem.getUri({ path: `${ROOT}/${path}`, directory: Directory.Data });
    return Capacitor.convertFileSrc(uri);
  },
};

// ── Browser fallback (IndexedDB) ────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("promptcut-studio", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = run(d.transaction("files", mode).objectStore("files"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const blobUrls = new Map<string, string>();

const webBackend: Backend = {
  async writeBytes(path, data) {
    await tx("readwrite", (s) => s.put(new Blob([data as BlobPart]), path));
    const old = blobUrls.get(path);
    if (old) URL.revokeObjectURL(old);
    blobUrls.delete(path);
  },
  async readBytes(path) {
    const blob = (await tx("readonly", (s) => s.get(path))) as Blob | undefined;
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  },
  async writeText(path, text) {
    await tx("readwrite", (s) => s.put(new Blob([text], { type: "text/plain" }), path));
  },
  async readText(path) {
    const blob = (await tx("readonly", (s) => s.get(path))) as Blob | undefined;
    return blob ? blob.text() : null;
  },
  async list(dir) {
    const keys = (await tx("readonly", (s) => s.getAllKeys())) as string[];
    const prefix = `${dir}/`;
    return keys.filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/")).map((k) => k.slice(prefix.length));
  },
  async remove(path) {
    await tx("readwrite", (s) => s.delete(path));
  },
  async removeDir(dir) {
    const keys = (await tx("readonly", (s) => s.getAllKeys())) as string[];
    for (const k of keys) if (k.startsWith(`${dir}/`)) await tx("readwrite", (s) => s.delete(k));
  },
  async url(path) {
    const have = blobUrls.get(path);
    if (have) return have;
    const blob = (await tx("readonly", (s) => s.get(path))) as Blob | undefined;
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    blobUrls.set(path, url);
    return url;
  },
};

export const files: Backend = isNative ? nativeBackend : webBackend;

/** The folder URL media files load from on Android, known after setup. */
let nativeBase = "";
export async function prepareFiles() {
  if (isNative) {
    await Filesystem.mkdir({ path: `${ROOT}/media`, directory: Directory.Data, recursive: true }).catch(() => {});
    nativeBase = (await nativeBackend.url("media/x")).replace(/\/x$/, "");
  }
}

/** A loadable URL for a media file, right now: null when the browser build hasn't opened it yet. */
export function mediaUrlNow(file: string): string | null {
  if (isNative) return `${nativeBase}/${file}`;
  return blobUrls.get(`media/${file}`) ?? null;
}

/** Make sure these media files have loadable URLs (the browser build opens them from IndexedDB). */
export async function openMedia(fileNames: string[]) {
  if (isNative) return;
  await Promise.all(fileNames.map((f) => webBackend.url(`media/${f}`)));
}
