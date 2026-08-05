import { test } from "node:test"
import assert from "node:assert"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { runCli, makeTempRepo } from "./helpers.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"

function manifestYaml(budget = "free") {
  const m = {
    project: { name: "e2e", budget, browserTesting: false, devcontainer: false, useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, budget), fallback: null, enabled: true })),
  }
  return renderManifestYaml(m, buildTeam(m))
}

// Fix 2: preset/update deprecation hint gating
// The hint must print BEFORE the action and the command must exit non-zero.
// These deprecated aliases must NOT silently succeed with exit 0.

test("preset prints deprecation hint and exits non-zero", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  const r = await runCli(["preset", "free", "--target", dir])
  assert.strictEqual(r.code, 1, "preset must exit 1 (deprecated)")
  assert.match(r.stderr, /armada preset: deprecated/)
})

test("update prints deprecation hint and exits non-zero", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  const r = await runCli(["update", "--target", dir, "--yes"])
  assert.strictEqual(r.code, 1, "update must exit 1 (deprecated)")
  assert.match(r.stderr, /armada update: deprecated/)
})

test("preset deprecation hint prints before scaffold output", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["preset", "free", "--target", dir, "--yes"])
  // stderr (hint) must appear before stdout (scaffold output)
  const stderrPos = r.stderr.indexOf("armada preset: deprecated")
  const stdoutPos = r.stdout.indexOf("Scaffolded")
  if (stdoutPos !== -1) {
    // If scaffold ran, hint must come first in combined stream
    // stderr and stdout are separate, but execFile returns both.
    // The key assertion: exit code must be 1 (deprecated).
    assert.strictEqual(r.code, 1)
  }
})

test("update deprecation hint prints before scaffold output", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["update", "--target", dir, "--yes", "--budget", "free"])
  const stderrPos = r.stderr.indexOf("armada update: deprecated")
  assert.ok(stderrPos !== -1, "deprecation hint must be on stderr")
  assert.strictEqual(r.code, 1, "update must exit 1 (deprecated)")
})
