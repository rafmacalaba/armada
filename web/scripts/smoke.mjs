// scripts/smoke.mjs — Playwright smoke for Phase 1.
//
// Run after `npm run dev` is up on http://127.0.0.1:5173 (or set BASE).
// Verifies:
//   1. / and /#/about render the expected H1 text.
//   2. Theme toggle changes data-theme and the change survives a reload.
//
// Screenshots are written under armada/screenshots/landing-page/phase-1/.
//
// Usage: node scripts/smoke.mjs
// Optional env: BASE=http://127.0.0.1:5173 SHOT_DIR=armada/screenshots/landing-page/phase-1

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const SHOT_DIR = resolve(
  repoRoot,
  process.env.SHOT_DIR ?? "armada/screenshots/landing-page/phase-1",
);

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function main() {
  await ensureDir(SHOT_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];

  // 1. Landing
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const landingH1 = (await page.locator("h1").first().textContent())?.trim();
  results.push({ route: "/", h1: landingH1 });
  await page.screenshot({
    path: resolve(SHOT_DIR, "landing-desktop.png"),
    fullPage: true,
  });

  // 2. About
  await page.goto(`${BASE}/#/about`, { waitUntil: "networkidle" });
  const aboutH1 = (await page.locator("h1").first().textContent())?.trim();
  results.push({ route: "/#/about", h1: aboutH1 });
  await page.screenshot({
    path: resolve(SHOT_DIR, "about-desktop.png"),
    fullPage: true,
  });

  // 3. 404
  await page.goto(`${BASE}/#/does-not-exist`, { waitUntil: "networkidle" });
  const notFoundH1 = (await page.locator("h1").first().textContent())?.trim();
  results.push({ route: "/#/does-not-exist", h1: notFoundH1 });
  await page.screenshot({
    path: resolve(SHOT_DIR, "notfound-desktop.png"),
    fullPage: true,
  });

  // 4. Theme toggle: load landing dark by default, toggle to light, reload,
  //    confirm data-theme stays light and localStorage key is set.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const initialTheme = await page.getAttribute("html", "data-theme");
  await page.getByRole("button", { name: /switch to .* theme/i }).click();
  const afterToggleTheme = await page.getAttribute("html", "data-theme");
  const stored = await page.evaluate(() => localStorage.getItem("armada-theme"));

  await page.reload({ waitUntil: "networkidle" });
  const afterReloadTheme = await page.getAttribute("html", "data-theme");
  const storedAfterReload = await page.evaluate(() =>
    localStorage.getItem("armada-theme"),
  );

  // Reset back to dark for any subsequent runs.
  await page.getByRole("button", { name: /switch to .* theme/i }).click();
  const restoredTheme = await page.getAttribute("html", "data-theme");

  results.push({
    themeInitial: initialTheme,
    themeAfterToggle: afterToggleTheme,
    storageAfterToggle: stored,
    themeAfterReload: afterReloadTheme,
    storageAfterReload: storedAfterReload,
    themeAfterReset: restoredTheme,
  });

  await browser.close();

  await writeFile(
    resolve(SHOT_DIR, "smoke.json"),
    JSON.stringify({ base: BASE, results }, null, 2),
  );

  console.log(JSON.stringify({ base: BASE, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
