// scripts/light-shot.mjs — capture home page in light theme to prove the toggle visually.
import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const SHOT_DIR = resolve(repoRoot, "armada/screenshots/home/light");
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.setItem("armada-theme", "light");
  document.documentElement.setAttribute("data-theme", "light");
});
await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");
await page.screenshot({ path: resolve(SHOT_DIR, "home-desktop-light.png"), fullPage: true });

await page.goto(`${BASE}/#/about`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.setItem("armada-theme", "light");
  document.documentElement.setAttribute("data-theme", "light");
});
await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");
await page.screenshot({ path: resolve(SHOT_DIR, "about-desktop-light.png"), fullPage: true });

await browser.close();
console.log("ok");
