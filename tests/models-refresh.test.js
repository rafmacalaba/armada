import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir, homedir } from "node:os"
import { join } from "node:path"
import { refreshModels, loadModelsCache, renderCatalog, modelFor, fallbackFor, validateCachePath, listOpenRouterModels, renderOpenRouterModels } from "../src/model-catalog.js"
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

// --- listOpenRouterModels ---

test("listOpenRouterModels resolves with injected fetch", async () => {
  const fakeFetch = async (_url) => ({
    ok: true,
    json: async () => ({ data: [{ id: "x", name: "X" }] }),
  })
  const models = await listOpenRouterModels({ fetch: fakeFetch })
  assert.deepStrictEqual(models, [{ id: "x", name: "X" }])
})

test("listOpenRouterModels throws on non-OK status with hint", async () => {
  const fakeFetch = async (_url) => ({ ok: false, status: 500 })
  await assert.rejects(
    () => listOpenRouterModels({ fetch: fakeFetch }),
    (err) => /check network/.test(err.message) && /OPENROUTER_API_KEY/.test(err.message),
  )
})

test("listOpenRouterModels wraps network errors with hint", async () => {
  const fakeFetch = async () => { throw new Error("ENOTFOUND") }
  await assert.rejects(
    () => listOpenRouterModels({ fetch: fakeFetch }),
    (err) => /check network/.test(err.message) && /OPENROUTER_API_KEY/.test(err.message) && /ENOTFOUND/.test(err.message),
  )
})

test("listOpenRouterModels uses default URL", async () => {
  let calledUrl = null
  const fakeFetch = async (url) => { calledUrl = url; return { ok: true, json: async () => ({ data: [] }) } }
  await listOpenRouterModels({ fetch: fakeFetch })
  assert.strictEqual(calledUrl, "https://openrouter.ai/api/v1/models")
})

test("listOpenRouterModels default opts.fetch is globalThis.fetch", async () => {
  // Verify the default parameter works (coverage only — actual global fetch not called in tests)
  const saved = globalThis.fetch
  try {
    let called = false
    globalThis.fetch = async () => { called = true; return { ok: true, json: async () => ({ data: [] }) } }
    await listOpenRouterModels()
    assert.ok(called)
  } finally {
    globalThis.fetch = saved
  }
})

// --- renderOpenRouterModels ---

test("renderOpenRouterModels auto-sizes columns with wide model id", () => {
  const models = [
    { id: "a", name: "short" },
    { id: "very-long-provider/very-long-model-id", name: "Wide Name Here Too" },
  ]
  const out = renderOpenRouterModels(models)
  const lines = out.split("\n")
  assert.strictEqual(lines.length, 3, "header + 2 rows")
  // All rows same length (padded to computed widths)
  assert.strictEqual(lines[1].length, lines[0].length)
  assert.strictEqual(lines[2].length, lines[0].length)
  // Columns separated by at least 2 spaces (padEnd + gutter produces >2)
  for (const line of lines) {
    assert.match(line, /\S\s{2,}\S/)
  }
})

test("renderOpenRouterModels does not crash on null id/name", () => {
  const out = renderOpenRouterModels([{ id: "x/y", name: null }, { id: null, name: "z" }])
  const lines = out.split("\n")
  assert.strictEqual(lines.length, 3, "header + 2 rows")
  assert.match(out, /x\/y/)
  assert.match(out, /z/)
})

test("renderOpenRouterModels empty returns just header", () => {
  const out = renderOpenRouterModels([])
  // "id  name" with auto-sized widths (no content to size against)
  assert.match(out, /^id  name$/)
})

// --- renderCatalog (Recommended) tag ---

test("renderCatalog tags first-choice model with (Recommended) for free budget", () => {
  const out = renderCatalog("free")
  // Every role's modelFor(role, "free") should carry the tag
  assert.match(out, /opencode\/big-pickle \(Recommended\)/)
  assert.match(out, /opencode-go\/hy3 \(Recommended\)/)
  assert.match(out, /opencode\/deepseek-v4-flash-free \(Recommended\)/)
})

test("renderCatalog tags first-choice model with (Recommended) for balanced budget", () => {
  const out = renderCatalog("balanced")
  assert.match(out, /opencode-go\/minimax-m3 \(Recommended\)/)
  assert.match(out, /opencode\/mimo-v2\.5-free \(Recommended\)/)
})

test("renderCatalog does not tag fallback with (Recommended) for balanced", () => {
  const out = renderCatalog("balanced")
  // For balanced budget, no primary matches a fallback, so fallback column is clean.
  // Check known fallback values never appear with (Recommended).
  assert.doesNotMatch(out, /openrouter\/z-ai\/glm-5\.2 \(Recommended\)/)
  assert.doesNotMatch(out, /openrouter\/deepseek\/deepseek-v4-pro \(Recommended\)/)
  assert.doesNotMatch(out, /openrouter\/minimax\/minimax-m3 \(Recommended\)/)
  assert.doesNotMatch(out, /openrouter\/xiaomi\/mimo-v2\.5 \(Recommended\)/)
})

test("renderCatalog (Recommended) absent from fallback for power budget", () => {
  const out = renderCatalog("power")
  // For power budget, some roles' first-choice IS the fallback (e.g. architect).
  // Model column may have fallback value + (Recommended), but fallback column must not.
  // Parse each line, extract fallback column, assert no (Recommended) there.
  const lines = out.split("\n").slice(1) // skip header
  assert.ok(lines.length > 0, "should have data rows")
  // Split each line on 2+ spaces to get columns
  for (const line of lines) {
    const cols = line.split(/  +/)
    // cols[0] = role, cols[1] = model, cols[2] = fallback
    assert.ok(cols.length >= 3, `expected 3 columns: ${line}`)
    const fallbackCell = cols[2].trim()
    assert.ok(!fallbackCell.includes("(Recommended)"), `fallback should not have (Recommended): "${fallbackCell}" in "${line}"`)
  }
})

test("renderCatalog columns do not merge with wide model ids (power budget)", () => {
  const out = renderCatalog("power", new Set(["openrouter/anthropic/claude-sonnet-4.6"]))
  const lines = out.split("\n")
  for (const line of lines) {
    // Each line has 3 columns = 2 gutters. With padEnd padding, gutter is >2 spaces.
    const matchCount = (line.match(/\S\s{2,}\S/g) || []).length
    assert.ok(matchCount >= 2, `expected >= 2 column gutters: "${line}"`)
  }
})
