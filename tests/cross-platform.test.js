import { test } from "node:test"
import assert from "node:assert"
import { runDoctor, checkCatalogConsistency } from "../src/doctor.js"
import { makeBin } from "./helpers.js"

// Cross-platform stability: doctor output format must be consistent
// across macOS and Linux when env is normalized.
const SH_MAC = "#!/bin/sh\ncase \"$1\" in\n  --version) echo 1.18.11 ;;\n  auth) echo openrouter ;;\n  providers) echo local ;;\n  *) echo ok ;;\nesac\n"

function envWith(binDir, extra = {}) {
  return { ...process.env, PATH: `${binDir}:${process.env.PATH}`, ...extra }
}

test("doctor output shape is stable across platforms", async () => {
  const binDir = makeBin({ opencode: SH_MAC, armada: "#!/bin/sh\necho v0.6.2\n" })
  const checks = await runDoctor({
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })

  // Every check has required shape
  for (const c of checks) {
    assert.ok(typeof c.name === "string" && c.name.length > 0, `check name must be non-empty string`)
    assert.ok(["pass", "fail", "warn"].includes(c.status), `check status must be pass/fail/warn, got "${c.status}"`)
    assert.ok(typeof c.detail === "string", `check detail must be string, got ${typeof c.detail}`)
  }

  // All expected check names are present
  const names = checks.map((c) => c.name)
  assert.ok(names.includes("opencode CLI"))
  assert.ok(names.includes("opencode version range"))
  assert.ok(names.includes("providers auth"))
  assert.ok(names.includes("openrouter auth"))
  assert.ok(names.includes("background dispatch"))
  assert.ok(names.includes("node"))
  assert.ok(names.includes("global armada binary"))
  assert.ok(names.includes("team roster"))
  assert.ok(names.includes("catalog consistency"))
})

test("doctor check names are deterministic — same env produces same ordering", async () => {
  const binDir = makeBin({ opencode: SH_MAC, armada: "#!/bin/sh\necho v0.6.2\n" })
  const env = envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" })

  const a = await runDoctor({ env })
  const b = await runDoctor({ env })

  const namesA = a.map((c) => c.name)
  const namesB = b.map((c) => c.name)
  assert.deepStrictEqual(namesA, namesB, "check ordering must be deterministic")
})

test("catalog consistency check shape is stable", () => {
  const results = checkCatalogConsistency()
  assert.ok(Array.isArray(results))
  for (const r of results) {
    assert.ok(typeof r.name === "string")
    assert.ok(["pass", "fail", "warn"].includes(r.status))
    assert.ok(typeof r.detail === "string")
  }
})

test("doctor checks do not depend on platform-specific env vars", async () => {
  const binDir = makeBin({ opencode: SH_MAC, armada: "#!/bin/sh\necho v0.6.2\n" })
  // Strip potential platform-specific vars
  const cleanEnv = { PATH: `${binDir}:${process.env.PATH}` }
  const checks = await runDoctor({ env: cleanEnv })

  // All checks should still run — some may fail if opencode auth needs env
  // but the structure should be identical
  const names = checks.map((c) => c.name)
  assert.ok(names.includes("opencode CLI"))
  assert.ok(names.includes("node"))
  assert.ok(names.includes("global armada binary"))
  assert.ok(names.includes("team roster"))
  assert.ok(names.includes("catalog consistency"))
})
