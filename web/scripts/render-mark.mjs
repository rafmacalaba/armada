// scripts/render-mark.mjs — render the SVG mark to a 1024x1024 master PNG.
//
// Writes: docs/logo.png (transparent background, #0369a1 stroke).
// The SVG paths are duplicated from web/public/favicon.svg so this script
// does not need the dev server.
//
// Usage: node scripts/render-mark.mjs
// Optional env: SIZE=1024 OUT=docs/logo.png ACCENT=#0369a1

import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

const SIZE = Number(process.env.SIZE ?? 1024);
const OUT = process.env.OUT ?? "docs/logo.png";
const ACCENT = process.env.ACCENT ?? "#0369a1";

const MARK_PATHS = [
  'M22 12 A7 7 0 1 0 22 24',
  'M22 8 V26',
  'M22 9 L16 14 H22',
  'M5 28 Q9 26 13 28 T21 28',
];

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  svg { display: block; width: ${SIZE}px; height: ${SIZE}px; }
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${SIZE}" height="${SIZE}">
  <g fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
${MARK_PATHS.map((d) => `    <path d="${d}" />`).join("\n")}
  </g>
</svg>
</body></html>`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: SIZE, height: SIZE },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const svg = page.locator("svg");
  const outPath = resolve(repoRoot, OUT);
  await mkdir(dirname(outPath), { recursive: true });
  await svg.screenshot({ path: outPath, omitBackground: true });
  await browser.close();
  // Copy to screenshot dir for evidence.
  const bytes = await readFile(outPath);
  const shotPath = resolve(repoRoot, "armada/screenshots/web-v2/logo-master.png");
  await mkdir(dirname(shotPath), { recursive: true });
  await writeFile(shotPath, bytes);
  console.log("ok", outPath, "->", shotPath, `(${bytes.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
