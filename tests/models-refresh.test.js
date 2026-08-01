import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { refreshModels, loadModelsCache, renderCatalog } from "../src/model-catalog.js"
import { makeBin } from "./helpers.js"

const MODELS_SH = "#!/bin/sh\necho \"opencode/big-pickle\nopencode/mimo-v2.5-free\nopencode-go/kimi-k2.7-code\"\n"

function envWith(binDir) { return { ...process.env, PATH: `${binDir}:${process.env.PATH}` } }

test("refreshModels parses output and caches", async () => {
  const binDir = makeBin({ opencode: MODELS_SH })
  const cache = join(mkdtempSync(join(tmpdir(), "armada-cache-")), "models.cache.json")
  const available = await refreshModels({ cachePath: cache, env: envWith(binDir) })
  assert.ok(available.has("opencode/big-pickle"))
  assert.ok(loadModelsCache(cache).has("opencode/mimo-v2.5-free"))
})

test("renderCatalog marks availability", () => {
  const out = renderCatalog("free", new Set(["opencode/big-pickle"]))
  assert.match(out, /✓opencode\/big-pickle/)
  assert.match(out, /✗/)
})

test("loadModelsCache returns null on missing cache", () => {
  assert.strictEqual(loadModelsCache("/nonexistent/cache.json"), null)
})
