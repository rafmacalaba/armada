import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { runCli, makeTempRepo, makeTempGitRepo } from "./helpers.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"

const EXPECTED_VERSION = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).version

function manifestYaml(budget = "free") {
  const m = {
    project: { name: "e2e", budget, browserTesting: false, devcontainer: false, useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, budget), fallback: null, enabled: true })),
  }
  return renderManifestYaml(m, buildTeam(m))
}

// DEF-001: uninstall -v / -h / --version should NOT perform destructive operations.
// They should print version/help and skip all removal.

test("uninstall -v prints version and exits 0, no fs mutation", async () => {
  // Create a repo with an armada/ dir and init to add state
  const dir = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  // Verify .opencode/ exists before test
  const { existsSync: ex } = await import("node:fs")
  assert.ok(ex(join(dir, ".opencode")), ".opencode should exist before uninstall -v")
  assert.ok(ex(join(dir, "armada", "armada.yaml")), "armada/armada.yaml should exist before uninstall -v")

  const r = await runCli(["uninstall", "-v"], { cwd: dir })
  assert.strictEqual(r.code, 0, "uninstall -v should exit 0")
  assert.match(r.stdout, /opencode-armada/, "should print version")
  assert.match(r.stdout, new RegExp(EXPECTED_VERSION.replace(/\./g, "\\.")), `should include version ${EXPECTED_VERSION}`)

  // .opencode/ must still exist (no mutation)
  assert.ok(ex(join(dir, ".opencode")), ".opencode should still exist after uninstall -v")
})

test("uninstall -h prints help and exits 0, no fs mutation", async () => {
  const dir = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  const { existsSync: ex } = await import("node:fs")
  assert.ok(ex(join(dir, ".opencode")), ".opencode should exist before uninstall -h")

  const r = await runCli(["uninstall", "-h"], { cwd: dir })
  assert.strictEqual(r.code, 0, "uninstall -h should exit 0")
  assert.match(r.stdout, /Usage:/, "should print help")

  assert.ok(ex(join(dir, ".opencode")), ".opencode should still exist after uninstall -h")
})

test("uninstall --version prints version and exits 0, no fs mutation", async () => {
  const dir = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  const { existsSync: ex } = await import("node:fs")
  assert.ok(ex(join(dir, ".opencode")), ".opencode should exist before uninstall --version")

  const r = await runCli(["uninstall", "--version"], { cwd: dir })
  assert.strictEqual(r.code, 0, "uninstall --version should exit 0")
  assert.match(r.stdout, /opencode-armada/, "should print version")

  assert.ok(ex(join(dir, ".opencode")), ".opencode should still exist after uninstall --version")
})

// Same checks for doctor, fleet, models, status, feature
test("doctor -v prints version and exits 0", async () => {
  const r = await runCli(["doctor", "-v"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /opencode-armada/)
})

test("doctor -h prints help and exits 0", async () => {
  const r = await runCli(["doctor", "-h"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
})

test("fleet -v prints version and exits 0", async () => {
  const r = await runCli(["fleet", "-v"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /opencode-armada/)
})

test("fleet -h prints help and exits 0", async () => {
  const r = await runCli(["fleet", "-h"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
})

test("models -v prints version and exits 0", async () => {
  const r = await runCli(["models", "-v"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /opencode-armada/)
})

test("models -h prints help and exits 0", async () => {
  const r = await runCli(["models", "-h"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
})

test("status -v prints version and exits 0", async () => {
  const r = await runCli(["status", "-v"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /opencode-armada/)
})

test("status -h prints help and exits 0", async () => {
  const r = await runCli(["status", "-h"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
})

test("feature -h prints help and exits 0", async () => {
  const r = await runCli(["feature", "-h"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
})
