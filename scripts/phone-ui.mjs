// Browser check of the phone build at phone size: home, a new project, the editor sheets,
// the sample video, export, and (with --ai) the AI Director and a short AI video build.
// Usage: node scripts/phone-ui.mjs <outDir> [--ai]   (with `npx vite preview --port 5191` running)
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("../../StickMan/node_modules/puppeteer-core");
const out = resolve(process.argv[2] ?? "phone-ui-out");
mkdirSync(out, { recursive: true });
const BASE = "http://localhost:5191";
const withAi = process.argv.includes("--ai");
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
// Inside the app, Capacitor sends outside requests natively, so there are no CORS limits.
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ["--disable-web-security", "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${join(out, "profile")}`],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  protocolTimeout: 1_800_000,
});
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 240)));
page.on("pageerror", (e) => errors.push(`PAGE ${String(e).slice(0, 240)}`));
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: out });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const shot = (n, full = false) => page.screenshot({ path: join(out, `${n}.png`), fullPage: full });
const click = (text, scope = "button") =>
  page.evaluate(
    (text, scope) => {
      const el = [...document.querySelectorAll(scope)].find((b) => b.textContent.replace(/\s+/g, " ").trim().includes(text) && !b.disabled);
      if (!el) throw new Error(`no enabled ${scope} with "${text}"`);
      el.scrollIntoView({ block: "center" });
      el.click();
    },
    text,
    scope
  );
const store = (fn, a) => page.evaluate(fn, a);

await page.goto(`${BASE}/?debug`, { waitUntil: "networkidle0" });
await wait(800);
await shot("1-home", true);
log("home", await page.evaluate(() => document.body.innerText.slice(0, 120).replace(/\s+/g, " ")));

if (withAi) {
  // The user's own keys from the studio's .env, saved through the phone's Settings route (never printed).
  const env = Object.fromEntries(
    readFileSync(resolve("../StickMan/.env"), "utf8")
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()])
  );
  const keys = ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "VISION_LLM_MODEL", "PEXELS_API_KEY", "POLLINATIONS_API_KEY"];
  const saved = await page.evaluate(async (vals) => (await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vals) })).status, Object.fromEntries(keys.filter((k) => env[k]).map((k) => [k, env[k]])));
  log("settings saved on the phone:", saved);
}

// A blank vertical project in the phone editor.
await click("Vertical video");
await page.waitForFunction(() => location.pathname.startsWith("/editor/") && document.querySelector("main canvas"), { timeout: 30_000 });
await wait(1500);
await shot("2-editor");
await click("Stickers");
await wait(900);
await shot("3-stickers-sheet");
await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button img")].slice(0, 1).forEach((i) => i.closest("button").click()));
await wait(700);
await click("Text");
await wait(600);
await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => /title|heading|text/i.test(b.textContent))?.click());
await wait(800);
const made = await store(() => window.__stickman.useStore.getState().scene.objects.map((o) => o.type));
log("objects added on the phone:", made);
await page.keyboard.press("Escape");
await wait(500);
await shot("4-editor-with-objects");

// Saved to the phone's storage?
await wait(2000);
const pid = await store(() => window.__stickman.useStore.getState().projectId);
const stored = await page.evaluate(async (id) => (await (await fetch(`/api/projects/${id}`)).json()).scene.objects.length, pid);
log("project saved on the phone with", stored, "objects");

// The bundled sample video.
await page.goto(`${BASE}/?debug`, { waitUntil: "networkidle0" });
await click("Sample video");
await page.waitForFunction(() => location.pathname.startsWith("/editor/") && window.__stickman?.useStore.getState().assets.length > 5, { timeout: 60_000 });
await wait(2500);
await store(() => window.__stickman.useStore.getState().setTime(12));
await wait(2500);
await shot("5-sample");

// Export (the browser build downloads; the app opens the share sheet).
await click("Export");
await wait(900);
await shot("6-export-dialog");
await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "Export")?.click());
log("exporting the sample");
await page.waitForFunction(() => [...document.querySelectorAll("[role=dialog]")].some((d) => /Saved |failed|could not/i.test(d.textContent)), { timeout: 20 * 60_000, polling: 2000 }).catch(() => {});
log(await page.evaluate(() => document.querySelector("[role=dialog]")?.innerText.slice(-240).replace(/\s+/g, " ")));
await wait(2500);
console.log("files", readdirSync(out).filter((f) => /\.(mp4|webm)$/.test(f)));

if (withAi) {
  await page.keyboard.press("Escape");
  await wait(500);
  await click("AI Director");
  await wait(800);
  await page.type("[data-ai-prompt]", "Add a big title that says Blockbuster's biggest mistake at the start");
  await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button[aria-label=Send]")][0]?.click());
  log("asked the AI Director");
  await page.waitForFunction(() => !window.__stickman.useStore.getState().aiBusy, { timeout: 300_000, polling: 1000 });
  await wait(1000);
  await shot("7-ai-director", false);
  const chat = await store(() => window.__stickman.useStore.getState().chat.slice(-1)[0]?.text?.slice(0, 200));
  log("director reply:", chat);
}

console.log("errors", errors.filter((e) => !/favicon/i.test(e)).slice(0, 12));
await browser.close();
