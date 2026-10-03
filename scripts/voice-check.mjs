// Checks that a voiced line is saved with real sound on the phone build: voices a line through
// the in-app server, reads the saved file back and measures its loudness.
// Real speech comes from a running desktop studio (localStorage "testVoiceServer"), since the
// browser build has no native voices.
// Usage: node scripts/voice-check.mjs [previewUrl] [studioUrl]
import { createRequire } from "node:module";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("../../StickMan/node_modules/puppeteer-core");
const BASE = process.argv[2] ?? "http://localhost:5191";
const STUDIO = process.argv[3] ?? "http://localhost:5178";
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ["--disable-web-security", "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${mkdtempSync(join(tmpdir(), "voice-check-"))}`],
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle0" });
await page.evaluate((s) => localStorage.setItem("testVoiceServer", s), STUDIO);
const result = await page.evaluate(async () => {
  const r = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Most people never get rich from their salary. Here is why.", voice: "man" }) });
  const v = await r.json();
  if (!r.ok) return { error: v.error };
  const file = await fetch(v.src);
  const bytes = await file.arrayBuffer();
  let peak = 0;
  if (bytes.byteLength) {
    const buf = await new AudioContext().decodeAudioData(bytes.slice(0));
    for (const x of buf.getChannelData(0)) peak = Math.max(peak, Math.abs(x));
  }
  return { reportedSeconds: Math.round(v.duration * 10) / 10, savedBytes: bytes.byteLength, peak: Math.round(peak * 1000) / 1000 };
});
console.log(result);
console.log(result.savedBytes > 1000 && result.peak > 0.05 ? "PASS: the saved voice has sound" : "FAIL: the saved voice is empty or silent");

// With --build: make a whole AI video (keys from ../StickMan/.env, never printed), check every
// narration file, then export and measure the sound in the finished MP4.
if (process.argv.includes("--build")) {
  const { readFileSync, readdirSync, mkdirSync } = await import("node:fs");
  const { spawnSync } = await import("node:child_process");
  const out = mkdtempSync(join(tmpdir(), "voice-build-"));
  mkdirSync(out, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: out });
  const env = Object.fromEntries(readFileSync("../StickMan/.env", "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
  const keys = ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "VISION_LLM_MODEL", "PEXELS_API_KEY", "POLLINATIONS_API_KEY"];
  await page.evaluate(async (vals) => void (await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vals) })), Object.fromEntries(keys.filter((k) => env[k]).map((k) => [k, env[k]])));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (text, scope = "button") =>
    page.evaluate((text, scope) => {
      const el = [...document.querySelectorAll(scope)].find((b) => b.textContent.replace(/\s+/g, " ").trim().includes(text) && !b.disabled);
      if (!el) throw new Error(`no enabled button with "${text}"`);
      el.click();
    }, text, scope);
  const waitText = (text, timeout) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 500 }, text);
  await page.goto(BASE + "/create", { waitUntil: "networkidle0" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  await click("Personal Finance");
  await click("Short (under 60s");
  const box = await page.$("textarea");
  if (box) await box.type("why most people never get rich from their salary");
  await click("Find fresh angles");
  await waitText("Pick an angle nobody", 240_000);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.querySelector("p.font-display")).click());
  await click("Write the script");
  await waitText("Choose the voice", 480_000);
  await click("Choose the voice");
  await waitText("Choose a voice", 20_000);
  await click("Build the video");
  console.log("building...");
  await page.waitForFunction(() => location.pathname.startsWith("/editor/") || /Open in the editor|Back to the voice/.test(document.body.innerText), { timeout: 40 * 60_000, polling: 2000 });
  if (!page.url().includes("/editor/")) await click("Open in the editor");
  await page.waitForFunction(() => location.pathname.startsWith("/editor/"), { timeout: 30_000 });
  // The test handle (window.__stickman) is only there with ?debug.
  await page.goto(page.url().split("?")[0] + "?debug", { waitUntil: "networkidle0" });
  await wait(5000);
  const narration = await page.evaluate(async () => {
    const s = window.__stickman.useStore.getState();
    const voiced = s.scene.objects.filter((o) => o.type === "audio" && o.role === "narration" && o.asset);
    const out = [];
    for (const o of voiced) {
      const a = s.assets.find((x) => x.id === o.asset);
      const bytes = await (await fetch(a.src)).arrayBuffer();
      let peak = 0;
      if (bytes.byteLength) for (const x of (await new AudioContext().decodeAudioData(bytes.slice(0))).getChannelData(0)) peak = Math.max(peak, Math.abs(x));
      out.push({ bytes: bytes.byteLength, peak: Math.round(peak * 100) / 100 });
    }
    return out;
  });
  console.log("narration files:", narration);
  await click("Export");
  await wait(800);
  await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "Export").click());
  console.log("exporting...");
  await page.waitForFunction(() => [...document.querySelectorAll("[role=dialog]")].some((d) => /Saved |failed/.test(d.textContent)), { timeout: 40 * 60_000, polling: 2000 });
  await wait(3000);
  const video = readdirSync(out).find((f) => /\.(mp4|webm)$/.test(f));
  const ffmpeg = require("../../StickMan/node_modules/ffmpeg-static");
  // volumedetect reports on stderr.
  const report = spawnSync(ffmpeg, ["-hide_banner", "-i", join(out, video), "-vn", "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
  const mean = report.match(/mean_volume: (-?[\d.]+) dB/)?.[1];
  console.log("exported:", video, "mean volume:", mean ? `${mean} dB` : "no audio track");
  const ok = narration.length > 0 && narration.every((n) => n.bytes > 1000 && n.peak > 0.05) && mean && Number(mean) > -40;
  console.log(ok ? "PASS: the AI video has its voice" : "FAIL: the AI video is missing its voice");
}
await browser.close();
