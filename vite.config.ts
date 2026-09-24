// The phone app is the studio itself: its pages, editor, engine and server routes are imported
// from ../StickMan, and the few server files that need Node (disk, ffmpeg, local voice models)
// are swapped for phone versions in src/server/shims. One copy of every shared package is used,
// the studio's own, so React and friends are never loaded twice.

import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, "../StickMan");
const SHIMS = join(HERE, "src/server/shims");

if (!existsSync(join(STUDIO, "src/engine/scene.ts"))) throw new Error(`The studio source was not found at ${STUDIO}`);

/** Module ids use forward slashes and keep their case, so every file is loaded exactly once. */
const posix = (p: string) => p.split(String.fromCharCode(92)).join("/");
/** For comparing paths only. */
const same = (p: string) => posix(p).toLowerCase();
const stripExt = (p: string) => p.replace(/[.](ts|tsx|js)$/, "");

/** Studio server files that need Node, and the phone file that replaces each. */
const SWAPS: Record<string, string> = {
  "server/settings": "settings.ts",
  "server/publicFiles": "publicFiles.ts",
  "server/media": "media.ts",
  "server/projects": "projects.ts",
  "server/tts": "tts.ts",
  "server/stt": "stt.ts",
  "server/convert": "convert.ts",
  "server/voices/local": "voicesLocal.ts",
  "server/autovideo/frames": "frames.ts",
};
const swapFor = new Map(Object.entries(SWAPS).map(([from, to]) => [same(join(STUDIO, from)), posix(join(SHIMS, to))]));
const PHONE_DIR = same(HERE);
const STUDIO_ENTRY = posix(join(STUDIO, "src/main.tsx"));

/** Packages only the phone app uses; everything else resolves from the studio. */
const PHONE_ONLY = [/^@capacitor\//, /^buffer$/];

function studio(): Plugin {
  return {
    name: "studio-bridge",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (source === "node:crypto") return posix(join(SHIMS, "nodeCrypto.ts"));
      if (!importer) return null;
      // A relative import of a swapped studio server file.
      if (source.startsWith(".")) return swapFor.get(stripExt(same(resolve(dirname(importer), source)))) ?? null;
      // Bare package imports from the phone's own files use the studio's copy.
      const fromPhone = same(importer).startsWith(PHONE_DIR) && !importer.includes("node_modules");
      const bare = !/^(\/|@\/|@server\/|@mobile\/|\0|[a-zA-Z]:)/.test(source);
      if (fromPhone && bare && !PHONE_ONLY.some((re) => re.test(source))) {
        const r = await this.resolve(source, STUDIO_ENTRY, { ...options, skipSelf: true });
        if (r) return r;
      }
      return null;
    },
  };
}

export default defineConfig({
  root: HERE,
  // Fonts, stickers, illustrations and the bundled demo all ship inside the app.
  publicDir: join(STUDIO, "public"),
  plugins: [studio(), react()],
  resolve: {
    alias: {
      "@server": posix(join(STUDIO, "server")),
      "@mobile": posix(join(HERE, "src")),
      "@": posix(join(STUDIO, "src")),
    },
  },
  define: {
    // Studio server code reads a few optional settings from the environment.
    "process.env": "{}",
  },
  build: {
    outDir: "dist",
    target: "es2022",
    chunkSizeWarningLimit: 4000,
    emptyOutDir: true,
  },
  server: { port: 5190, fs: { allow: [HERE, STUDIO] } },
  preview: { port: 5191 },
});
