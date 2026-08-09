// scripts/docs-smoke.mjs — Playwright smoke for Phase 3 (Docs page).
//
// Run after `npm run dev` is up on http://127.0.0.1:5173 (or set BASE).
// Verifies:
//   1. /#/docs renders the expected H1 "Docs".
//   2. The three group sections render in order: get-started, operate-it, contribute.
//   3. Every GitHub-anchored link points at a real local markdown file under
//      repoRoot/docs/ or repoRoot/CONTRIBUTING.md.
//   4. The TopNav "Docs" link receives aria-current="page" when on /#/docs.
//   5. No console errors during page load.
//   6. Desktop + mobile screenshots written under armada/screenshots/web-v2/.
//
// Usage: node scripts/docs-smoke.mjs
// Optional env: BASE=http://127.0.0.1:5173

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const SHOT_DIR = resolve(repoRoot, "armada/screenshots/web-v2-followup");
// Single source of truth for the repo's default branch. If the repo renames
// its default branch, this is the only place to update — Docs.tsx and any
// other consumer should derive from this constant.
const DEFAULT_BRANCH = "master";
const REPO_BLOB = `https://github.com/rafmacalaba/armada/blob/${DEFAULT_BRANCH}`;

const EXPECTED_GROUPS = ["get-started", "operate-it", "contribute"];

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

// Resolve a GitHub blob URL to a local file path under repoRoot.
// Throws if the file does not exist.
function localPathFor(href) {
  if (!href.startsWith(REPO_BLOB + "/")) {
    throw new Error(`unexpected non-blob href: ${href}`);
  }
  const rel = href.slice(REPO_BLOB.length + 1); // strip ".../blob/main/"
  // Allow only simple <dir>/<file>.md paths, no traversal.
  if (rel.includes("..") || rel.startsWith("/")) {
    throw new Error(`unsafe blob path: ${rel}`);
  }
  const abs = resolve(repoRoot, rel);
  if (!existsSync(abs)) {
    throw new Error(`local file missing for ${href}: ${abs}`);
  }
  return { rel, abs };
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

  // 1. Navigate to /#/docs.
  await page.goto(`${BASE}/#/docs`, { waitUntil: "networkidle" });

  const title = await page.title();
  const h1 = (await page.locator("h1").first().textContent())?.trim();
  const description = await page
    .locator('meta[name="description"]')
    .first()
    .getAttribute("content");

  // 2. All three group headings present and in order.
  const groupReports = [];
  for (const id of EXPECTED_GROUPS) {
    const heading = page.locator(`section#${id} h2`);
    const count = await heading.count();
    const text = count > 0 ? (await heading.first().textContent())?.trim() : null;
    groupReports.push({ id, found: count === 1, text });
  }

  // 3. Every GitHub-anchored link resolves to a real local file.
  const linkCheck = await page.evaluate((blobPrefix) => {
    const anchors = Array.from(document.querySelectorAll("main a[href]"));
    return anchors.map((a) => ({
      href: a.getAttribute("href"),
      text: a.textContent?.trim() ?? "",
      rel: a.getAttribute("rel"),
      target: a.getAttribute("target"),
    })).filter((l) => l.href.startsWith(blobPrefix));
  }, REPO_BLOB);

  const localFiles = [];
  const missing = [];
  const branchMismatch = [];
  for (const link of linkCheck) {
    try {
      const { rel, abs } = localPathFor(link.href);
      // Drift guard: assert the branch segment of every docs href matches the
      // repo's actual default branch. Catches Docs.tsx regressing to "main"
      // (or any other wrong branch) even when the local file still exists.
      // Path shape: /<user>/<repo>/blob/<branch>/<file> — branch lives at [4].
      const branchSegment = new URL(link.href).pathname.split("/")[4];
      if (branchSegment !== DEFAULT_BRANCH) {
        branchMismatch.push({
          href: link.href,
          branch: branchSegment,
          expected: DEFAULT_BRANCH,
        });
      }
      localFiles.push({ href: link.href, text: link.text, rel, abs, ok: true });
    } catch (err) {
      missing.push({ href: link.href, error: err.message });
    }
  }

  // 4. TopNav "Docs" link is aria-current="page".
  const navDocs = page.locator('header.topnav nav a[href="#/docs"]').first();
  const navDocsAriaCurrent = await navDocs.getAttribute("aria-current");
  const navDocsClass = await navDocs.getAttribute("class");

  // 5. Screenshots: desktop + mobile.
  await page.screenshot({
    path: resolve(SHOT_DIR, "docs-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/#/docs`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: resolve(SHOT_DIR, "docs-mobile.png"),
    fullPage: true,
  });

  await browser.close();

  const failed = [];
  if (h1 !== "Docs") failed.push(`h1: ${h1}`);
  if (!description) failed.push("meta description");
  const groupsOk = groupReports.every(
    (g) => g.found && EXPECTED_GROUPS.indexOf(g.id) === groupReports.findIndex((x) => x.id === g.id),
  );
  if (!groupsOk) failed.push("group-order");
  if (groupReports.some((g) => !g.found)) failed.push("group-missing");
  if (missing.length > 0) failed.push("missing-local-files");
  if (branchMismatch.length > 0) failed.push("branch-mismatch");
  // Drift guard: if the page rendered zero REPO_BLOB links, Docs.tsx has
  // likely regressed to a wrong branch while the smoke's constant stayed
  // correct — fail loudly instead of silently validating an empty set.
  if (linkCheck.length === 0) failed.push("no-docs-links");
  if (navDocsAriaCurrent !== "page") failed.push(`aria-current: ${navDocsAriaCurrent}`);
  if (linkCheck.some((l) => !l.rel || !l.rel.includes("noopener"))) {
    failed.push("rel-noopener");
  }
  if (consoleErrors.length > 0) failed.push("console-errors");

  const report = {
    base: BASE,
    title,
    h1,
    description,
    defaultBranch: DEFAULT_BRANCH,
    groups: groupReports,
    links: linkCheck,
    localFiles,
    missing,
    branchMismatch,
    navDocs: { ariaCurrent: navDocsAriaCurrent, class: navDocsClass },
    consoleErrors,
  };

  await writeFile(
    resolve(SHOT_DIR, "docs-smoke.json"),
    JSON.stringify(report, null, 2),
  );

  if (failed.length > 0) {
    console.error("DOCS SMOKE FAILED:", failed.join(", "));
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log("DOCS SMOKE OK");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
