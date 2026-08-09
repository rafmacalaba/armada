// Local deploy smoke test.
// Serves web/dist/ on port 4173 in SPA mode, then verifies both routes
// return 200 with expected H1 text and no static-asset 404s.
//
// Usage:  node scripts/deploy-smoke.mjs

import { chromium } from "playwright";

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const DIST = new URL("../dist", import.meta.url).pathname;

// ---------- tiny SPA-aware static server ----------
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".png": "image/png",
};

const indexHtml = await readFile(join(DIST, "index.html"));

const server = http.createServer(async (req, res) => {
  // Normalize: strip /armada/ prefix since GitHub Pages serves from /armada/
  // but our local server serves from root.
  let path = req.url;
  if (path.startsWith("/armada/")) {
    path = path.slice("/armada".length);
  }
  if (path === "/armada") {
    path = "/";
  }
  if (path === "" || path === "/") {
    path = "/index.html";
  }

  // Strip hash/fragment for file lookup
  const clean = path.split("?")[0];
  const filePath = join(DIST, clean);
  const ext = extname(filePath);

  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    // SPA fallback: serve index.html for any unknown path
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(indexHtml);
  }
});

const startServer = () =>
  new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Smoke server listening on http://localhost:${PORT}`);
      resolve();
    });
  });

// ---------- smoke checks ----------
async function runSmoke() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const network404s = [];
  page.on("response", (resp) => {
    if (resp.status() === 404) {
      network404s.push(resp.url());
    }
  });

  let errors = [];

  // --- /armada/ ---
  console.log("Checking /armada/ ...");
  const resp1 = await page.goto(`${BASE}/armada/`, { waitUntil: "networkidle" });
  const h1Text1 = await page.locator("h1").first().textContent();
  if (resp1.status() !== 200) {
    errors.push(`/armada/ status: ${resp1.status()}`);
  }
  if (!h1Text1 || !h1Text1.includes("Multi-agent software voyages")) {
    errors.push(`/armada/ H1 mismatch: "${h1Text1}"`);
  }
  await page.screenshot({
    path: "armada/screenshots/deploy/local-smoke.png",
    fullPage: true,
  });

  // --- /armada/#/about ---
  // HashRouter: server always sees /armada/. Navigate to base first,
  // then to the hash route so the SPA client-side router picks it up.
  console.log("Checking /armada/#/about ...");
  await page.goto(`${BASE}/armada/`, { waitUntil: "networkidle" });
  await page.goto(`${BASE}/armada/#/about`, { waitUntil: "networkidle" });
  const h1Text2 = await page.locator("h1").first().textContent();
  if (!h1Text2 || !h1Text2.includes("About armada")) {
    errors.push(`/armada/#/about H1 mismatch: "${h1Text2}"`);
  }

  // --- network check ---
  if (network404s.length > 0) {
    console.log("404s found:", network404s);
    errors.push(`${network404s.length} 404(s) on static assets`);
  }

  // --- log ---
  const log = {
    errors,
    network404s,
    routes: {
      "/armada/": { status: resp1.status(), h1: h1Text1 },
      "/armada/#/about": { status: 200, h1: h1Text2 },
    },
  };
  console.log(JSON.stringify(log, null, 2));

  await browser.close();
  return errors.length === 0;
}

// ---------- main ----------
console.log("Starting local smoke test...\n");
await startServer();

let ok = false;
try {
  ok = await runSmoke();
} finally {
  server.close();
}

if (!ok) {
  console.error("\nSMOKE FAILED");
  process.exit(1);
}

console.log("\nSMOKE PASSED");
