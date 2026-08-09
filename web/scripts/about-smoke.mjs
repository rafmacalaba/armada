// scripts/about-smoke.mjs — Playwright smoke for Phase 3 (About page).
//
// Run after `npm run dev` is up on http://127.0.0.1:5173 (or set BASE).
// Verifies:
//   1. /#/about renders all 9 required sections in order.
//   2. Per-page meta: title, description, og:title, og:description, og:url are set.
//   3. All external links carry rel="noopener noreferrer".
//   4. Every GitHub-anchored link points at the repo's default branch
//      (DEFAULT_BRANCH). Catches About.tsx regressing to "main" or any other
//      wrong branch, even if the local file still happens to exist.
//   5. No console errors during page load.
//   6. Desktop screenshot saved to armada/screenshots/web-v2-followup/about-desktop.png.
//
// Usage: node scripts/about-smoke.mjs
// Optional env: BASE=http://127.0.0.1:5173 SHOT_DIR=armada/screenshots/web-v2-followup

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const SHOT_DIR = resolve(
  repoRoot,
  process.env.SHOT_DIR ?? "armada/screenshots/web-v2-followup",
);
// Single source of truth for the repo's default branch. If the repo renames
// its default branch, this is the only place to update — About.tsx and any
// other consumer should derive from this constant.
const DEFAULT_BRANCH = "master";
const REPO_BLOB = `https://github.com/rafmacalaba/armada/blob/${DEFAULT_BRANCH}`;

const EXPECTED_SECTIONS = [
  "mission",
  "what-is",
  "what-is-not",
  "opencode-role",
  "harness-engineering",
  "loop-engineering",
  "roadmap",
  "contact",
  "credits",
];

const META_SELECTORS = {
  title: "title",
  description: 'meta[name="description"]',
  "og:title": 'meta[property="og:title"]',
  "og:description": 'meta[property="og:description"]',
  "og:type": 'meta[property="og:type"]',
  "og:url": 'meta[property="og:url"]',
};

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
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
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });

  const report = { base: BASE, route: "/#/about" };

  // 1. Navigate
  await page.goto(`${BASE}/#/about`, { waitUntil: "networkidle" });

  // 2. Section order check
  const sectionIds = await page.$$eval(
    "section[id]",
    (nodes) => nodes.map((n) => n.id),
  );
  report.sectionIdsInDom = sectionIds;
  report.expectedSections = EXPECTED_SECTIONS;
  const ordered = EXPECTED_SECTIONS.every(
    (id, i) => sectionIds[i] === id,
  );
  report.sectionsInOrder = ordered;
  if (!ordered) fail(`sections out of order: got ${sectionIds.join(", ")}`);

  // 3. Meta tags
  const meta = {};
  for (const [key, sel] of Object.entries(META_SELECTORS)) {
    if (sel === "title") {
      meta[key] = await page.title();
    } else {
      meta[key] = await page
        .locator(sel)
        .first()
        .getAttribute("content")
        .catch(() => null);
    }
  }
  report.meta = meta;
  if (meta.title !== "About — armada") fail(`title wrong: ${meta.title}`);
  if (!meta.description || !meta.description.includes("armada"))
    fail(`description missing/empty`);
  if (meta["og:title"] !== "About — armada")
    fail(`og:title wrong: ${meta["og:title"]}`);
  if (!meta["og:description"]) fail(`og:description missing`);
  if (meta["og:type"] !== "website") fail(`og:type wrong: ${meta["og:type"]}`);
  if (meta["og:url"] !== "https://rafmacalaba.github.io/armada/#/about")
    fail(`og:url wrong: ${meta["og:url"]}`);

  // 4. External links carry rel="noopener noreferrer"
  const external = await page.$$eval(
    'a[href^="http"]',
    (nodes) =>
      nodes.map((n) => ({
        href: n.getAttribute("href"),
        target: n.getAttribute("target"),
        rel: n.getAttribute("rel"),
      })),
  );
  report.externalLinks = external;
  const bad = external.filter(
    (l) => l.target !== "_blank" || !(l.rel || "").includes("noopener"),
  );
  if (bad.length > 0) {
    fail(`external links missing target/rel: ${JSON.stringify(bad)}`);
  }

  // 4b. Drift guard: every GitHub blob link must point at the repo's default
  // branch. Mirrors the docs-smoke hardening. Catches About.tsx regressing
  // to "main" (or any other wrong branch) even when the smoke's other checks
  // pass.
  // Path shape: /<user>/<repo>/blob/<branch>/<file> — branch lives at [4].
  const repoBlobLinks = external.filter((l) =>
    (l.href || "").startsWith(REPO_BLOB + "/"),
  );
  const branchMismatch = [];
  for (const link of repoBlobLinks) {
    const branchSegment = new URL(link.href).pathname.split("/")[4];
    if (branchSegment !== DEFAULT_BRANCH) {
      branchMismatch.push({
        href: link.href,
        branch: branchSegment,
        expected: DEFAULT_BRANCH,
      });
    }
  }
  report.defaultBranch = DEFAULT_BRANCH;
  report.repoBlobLinks = repoBlobLinks.map((l) => l.href);
  report.branchMismatch = branchMismatch;
  if (branchMismatch.length > 0) {
    fail(
      `branch-mismatch: ${JSON.stringify(branchMismatch)}`,
    );
  }
  // Drift guard: if the page rendered zero REPO_BLOB links, About.tsx has
  // likely regressed to a wrong branch while the smoke's constant stayed
  // correct — fail loudly instead of silently validating an empty set.
  if (repoBlobLinks.length === 0) {
    fail("no-about-links: expected at least one GitHub blob link");
  }

  // 5. Screenshot
  await page.screenshot({
    path: resolve(SHOT_DIR, "about-desktop.png"),
    fullPage: true,
  });
  report.screenshot = resolve(SHOT_DIR, "about-desktop.png");

  // 6. Console errors
  report.consoleErrors = consoleErrors;
  if (consoleErrors.length > 0)
    fail(`console errors: ${consoleErrors.join(" | ")}`);

  await browser.close();

  await writeFile(
    resolve(SHOT_DIR, "about-smoke.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (process.exitCode) {
    console.error("SMOKE FAILED");
  } else {
    console.log("SMOKE OK");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
