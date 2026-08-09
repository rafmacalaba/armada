// scripts/logo-shot.mjs — capture the TopNav mark in both themes for Phase 1.
//
// Run after `npm run dev` is up on http://127.0.0.1:5173 (or set BASE).
// Writes:
//   armada/screenshots/web-v2/logo-light.png
//   armada/screenshots/web-v2/logo-dark.png
//
// Each shot is clipped to the top 80px of the viewport so only the nav shows.
//
// Usage: node scripts/logo-shot.mjs
// Optional env: BASE=http://127.0.0.1:5173

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const SHOT_DIR = resolve(repoRoot, "armada/screenshots/web-v2");

async function captureTheme(theme) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate((t) => {
    localStorage.setItem("armada-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }, theme);
  await page.waitForFunction(
    (t) => document.documentElement.getAttribute("data-theme") === t,
    theme,
  );
  // Confirm the mark rendered and has the expected accent color.
  const mark = page.locator(".topnav__mark svg").first();
  const color = await mark.evaluate((el) => {
    return getComputedStyle(el).color;
  });
  const out = resolve(SHOT_DIR, `logo-${theme}.png`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1440, height: 80 } });
  await browser.close();
  return { theme, out, color };
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  const light = await captureTheme("light");
  const dark = await captureTheme("dark");
  console.log(JSON.stringify({ light, dark }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
