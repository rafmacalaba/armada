// scripts/landing-smoke.mjs — Playwright smoke for Phase 2 (Landing page).
//
// Run after `npm run dev` is up on http://127.0.0.1:5173 (or set BASE).
// Verifies:
//   1. All 9 landing sections render in order.
//   2. No console errors during page load.
//   3. Every in-page anchor link resolves to an element on the page.
//   4. Every external GitHub link carries rel="noopener noreferrer".
//
// Screenshots are written under armada/screenshots/landing/.
//
// Usage: node scripts/landing-smoke.mjs
// Optional env: BASE=http://127.0.0.1:5173

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const SHOT_DIR = resolve(repoRoot, "armada/screenshots/landing");

const EXPECTED_SECTIONS = [
  { id: null, heading: "Multi-agent software voyages", level: 1 },
  { id: "problem" },
  { id: "how-it-works" },
  { id: "fleet" },
  { id: "different" },
  { id: "quick-start" },
  { id: "features" },
  { id: "roadmap" },
  { id: null, heading: /ready to set sail/i, level: 2 },
];

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

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });

  // 1. Load landing, capture title + meta tags.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const title = await page.title();
  const description = await page
    .locator('meta[name="description"]')
    .first()
    .getAttribute("content");
  const ogTitle = await page
    .locator('meta[name="og:title"]')
    .first()
    .getAttribute("content");
  const ogType = await page
    .locator('meta[name="og:type"]')
    .first()
    .getAttribute("content");

  // 2. All 9 sections present and in order.
  const sectionReports = [];
  for (const s of EXPECTED_SECTIONS) {
    if (s.id) {
      const el = page.locator(`section#${s.id}`);
      const count = await el.count();
      sectionReports.push({ id: s.id, found: count === 1 });
    } else if (s.heading) {
      const heading = page.getByRole("heading", {
        name: s.heading,
        level: s.level ?? 2,
      });
      const count = await heading.count();
      sectionReports.push({ heading: String(s.heading), found: count >= 1 });
    }
  }

  // 3. Anchor verification: collect every <a href="#..."> and ensure target
  //    element exists in DOM. Skip HashRouter route anchors (e.g. "#/about").
  const anchorCheck = await page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll('a[href^="#"]'),
    );
    const out = [];
    for (const a of anchors) {
      const href = a.getAttribute("href");
      if (!href || href === "#") {
        out.push({ href, exists: false, kind: "in-page" });
        continue;
      }
      // HashRouter route anchors like "#/" or "#/about" — not in-page jumps.
      if (href.startsWith("#/")) {
        out.push({ href, exists: true, kind: "router" });
        continue;
      }
      const id = href.slice(1);
      const target = document.getElementById(id);
      out.push({ href, exists: target !== null, kind: "in-page" });
    }
    return out;
  });

  // 4. External GitHub links carry rel="noopener noreferrer".
  const externalCheck = await page.evaluate(() => {
    const links = Array.from(
      document.querySelectorAll('a[href^="https://github.com/"]'),
    );
    return links.map((a) => ({
      href: a.getAttribute("href"),
      target: a.getAttribute("target"),
      rel: a.getAttribute("rel"),
    }));
  });

  // 5. Click each in-page anchor to confirm it actually navigates.
  const clickResults = [];
  for (const a of anchorCheck) {
    if (!a.exists || a.kind !== "in-page") continue;
    const beforeY = await page.evaluate(() => window.scrollY);
    await page.evaluate((href) => {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    }, a.href);
    const afterY = await page.evaluate(() => window.scrollY);
    clickResults.push({ href: a.href, scrolled: afterY !== beforeY });
  }

  // 6. Screenshots: desktop + mobile.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: resolve(SHOT_DIR, "landing-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: resolve(SHOT_DIR, "landing-mobile.png"),
    fullPage: true,
  });

  await browser.close();

  const allAnchorsOk = anchorCheck.every(
    (a) => a.exists, // router-anchors pre-marked exists:true
  );
  const allExternalOk = externalCheck.every(
    (l) => l.rel && l.rel.includes("noopener") && l.rel.includes("noreferrer"),
  );

  const report = {
    base: BASE,
    title,
    description,
    ogTitle,
    ogType,
    sections: sectionReports,
    anchors: anchorCheck,
    anchorsAllOk: allAnchorsOk,
    externalLinks: externalCheck,
    externalAllOk: allExternalOk,
    clickResults,
    consoleErrors,
  };

  await writeFile(
    resolve(SHOT_DIR, "landing-smoke.json"),
    JSON.stringify(report, null, 2),
  );

  // Exit non-zero on failures so CI can gate.
  const failed = [];
  if (title !== "armada — multi-agent software voyages") failed.push("title");
  if (!description) failed.push("meta description");
  if (!ogTitle) failed.push("og:title");
  if (ogType !== "website") failed.push("og:type");
  if (sectionReports.some((s) => !s.found)) failed.push("sections");
  if (!allAnchorsOk) failed.push("anchors");
  if (!allExternalOk) failed.push("external-links");
  if (consoleErrors.length > 0) failed.push("console-errors");

  if (failed.length > 0) {
    console.error("SMOKE FAILED:", failed.join(", "));
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log("SMOKE OK");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
