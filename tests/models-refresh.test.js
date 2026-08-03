import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir, homedir } from "node:os"
import { join } from "node:path"
import { refreshModels, loadModelsCache, renderCatalog, modelFor, fallbackFor, validateCachePath } from "../src/model-catalog.js"
import { makeBin } from "./helpers.js"

const MODELS_SH = "#!/bin/sh\necho \"opencode/big-pickle\nopencode/mimo-v2.5-free\nopencode-go/kimi-k2.7-code\"\n"

function envWith(binDir) { return { ...process.env, PATH: `${binDir}:${process.env.PATH}` } }

test("refreshModels parses output and caches", async () => {
  const binDir = makeBin({ opencode: MODELS_SH })
  const base = mkdtempSync(join(tmpdir(), "armada-cache-"))
  const prevCwd = process.cwd()
  process.chdir(base)
  try {
    // relative cache filename resolves under cwd (validated path)
    const available = await refreshModels({ cachePath: "models.cache.json", env: envWith(binDir) })
    assert.ok(available.has("opencode/big-pickle"))
    assert.ok(loadModelsCache("models.cache.json").has("opencode/mimo-v2.5-free"))
  } finally {
    process.chdir(prevCwd)
  }
})

test("renderCatalog marks availability", () => {
  const out = renderCatalog("free", new Set(["opencode/big-pickle"]))
  assert.match(out, /✓opencode\/big-pickle/)
  assert.match(out, /✗/)
})

test("renderCatalog omits markers when availability is null", () => {
  const out = renderCatalog("free", null)
  assert.doesNotMatch(out, /✓/)
  assert.doesNotMatch(out, /✗/)
})

test("loadModelsCache returns null on missing cache", () => {
  assert.strictEqual(loadModelsCache("/nonexistent/cache.json"), null)
})

test("modelFor throws on unknown role", () => {
  assert.throws(() => modelFor("nope", "balanced"), /Unknown role/)
})

test("fallbackFor returns known role fallback", () => {
  assert.strictEqual(fallbackFor("qa"), "openrouter/xiaomi/mimo-v2.5")
})

test("loadModelsCache returns null when models is not an array", () => {
  const cache = join(mkdtempSync(join(tmpdir(), "armada-badmodels-")), "cache.json")
  writeFileSync(cache, JSON.stringify({ updatedAt: "2026-01-01", models: "not-array" }))
  assert.strictEqual(loadModelsCache(cache), null)
})

test("loadModelsCache warns and returns null on corrupt cache", () => {
  const cache = join(mkdtempSync(join(tmpdir(), "armada-corrupt-")), "cache.json")
  writeFileSync(cache, "not json")
  const warns = []
  const origWarn = console.warn
  console.warn = (m) => warns.push(m)
  try {
    assert.strictEqual(loadModelsCache(cache), null)
  } finally {
    console.warn = origWarn
  }
  assert.ok(warns.some((w) => /corrupt/.test(w)))
})

test("validateCachePath rejects traversal and arbitrary writes", () => {
  assert.throws(() => validateCachePath("/etc/passwd"), /cache path/)
  assert.throws(() => validateCachePath("../../etc/shadow"), /cache path/)
  assert.throws(() => validateCachePath("~/.bashrc"), /cache path/)
  // absolute path under ~/.armada is fine
  const ok = join(homedir(), ".armada", "models.cache.json")
  assert.doesNotThrow(() => validateCachePath(ok))
  // relative filename resolves under cwd — allowed
  assert.doesNotThrow(() => validateCachePath("models.cache.json"))
})
