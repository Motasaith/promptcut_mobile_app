// Finds anything wider than the phone screen on every page of the phone build.
// Usage: node scripts/overflow.mjs [outDir] [width]   (with `npx vite preview --port 5191` running)
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("../../StickMan/node_modules/puppeteer-core");
const out = resolve(process.argv[2] ?? "overflow-out");
const width = Number(process.argv[3] ?? 360);
mkdirSync(out, { recursive: true });
const BASE = "http://localhost:5191";
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ["--disable-web-security", `--user-data-dir=${join(out, "profile")}`],
  defaultViewport: { width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The deepest elements that stick out past the right edge, plus the page's scroll width. */
const scan = () =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const clipped = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (p.tagName === "svg") continue;
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return p.getBoundingClientRect().right <= vw + 1;
      }
      return false;
    };
    const wide = [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && !el.closest("svg *") && (r.right > vw + 1 || r.left < -1) && !clipped(el) && getComputedStyle(el).position !== "fixed";
    });
    const leaves = wide.filter((el) => !wide.some((o) => o !== el && el.contains(o)));
    return {
      scrollWidth: document.documentElement.scrollWidth,
      vw,
      items: leaves.slice(0, 12).map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()} [${Math.round(r.left)}..${Math.round(r.right)}] .${String(el.className).slice(0, 90)} "${(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50)}"`;
      }),
    };
  });

const report = async (name) => {
  await wait(1200);
  const r = await scan();
  console.log(`\n== ${name}: page ${r.scrollWidth}px on a ${r.vw}px screen${r.scrollWidth > r.vw ? "  << SCROLLS SIDEWAYS" : ""}`);
  for (const i of r.items) console.log("   " + i);
  await page.screenshot({ path: join(out, `${name.replace(/[^a-z0-9]+/gi, "-")}.png`) });
};

const routes = ["/", "/create", "/batch", "/voices", "/help", "/settings", "/legal/credits", "/legal/privacy", "/legal/terms"];
for (const r of routes) {
  await page.goto(BASE + r, { waitUntil: "networkidle0" });
  await report(r);
}

// The editor, with the sample project.
await page.goto(BASE + "/", { waitUntil: "networkidle0" });
const opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /sample/i.test(x.textContent || ""));
  b?.click();
  return !!b;
});
if (opened) {
  await wait(4000);
  await report("editor " + new URL(page.url()).pathname);
}

// With --create: walk every step of the AI video maker (uses the keys in ../StickMan/.env, never printed).
if (process.argv.includes("--create")) {
  const env = Object.fromEntries(
    readFileSync(resolve("../StickMan/.env"), "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()])
  );
  const keys = ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "VISION_LLM_MODEL", "PEXELS_API_KEY", "POLLINATIONS_API_KEY"];
  await page.evaluate(async (vals) => void (await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vals) })), Object.fromEntries(keys.filter((k) => env[k]).map((k) => [k, env[k]])));
  const click = (text) =>
    page.evaluate((text) => {
      const el = [...document.querySelectorAll("button")].find((b) => b.textContent.replace(/\s+/g, " ").trim().includes(text) && !b.disabled);
      if (!el) throw new Error(`no enabled button with "${text}"`);
      el.click();
    }, text);
  const waitText = (text, timeout) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 500 }, text);
  await page.goto(BASE + "/create", { waitUntil: "networkidle0" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  await click("Personal Finance");
  await click("Short (under 60s");
  const box = await page.$("textarea");
  if (box) await box.type("why most people never get rich from their salary");
  await report("create 1 idea");
  await click("Find fresh angles");
  await waitText("Pick an angle nobody", 240_000);
  await report("create 2 angles");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.querySelector("p.font-display")).click());
  await click("Write the script");
  await waitText("Choose the voice", 480_000);
  await report("create 3 script");
  await click("Choose the voice");
  await waitText("Choose a voice", 20_000);
  await report("create 4 voice");
  await click("Build the video");
  await wait(15_000);
  await report("create 5 building");
  await page.waitForFunction(() => location.pathname.startsWith("/editor/") || /Open in the editor|Back to the voice/.test(document.body.innerText), { timeout: 40 * 60_000, polling: 2000 });
  await report("create 6 finished");
  if (!page.url().includes("/editor/")) {
    await click("Open in the editor").catch(() => {});
    await wait(5000);
    await report("create 7 editor");
  }
}
await browser.close();
