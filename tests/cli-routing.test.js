import { test } from "node:test"
import assert from "node:assert"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
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

// Fix 3: reconcile exit code reflects actual outcome, not always 1.
// Also verify reconcile appears in help text.

test("reconcile exits 0 when no state dir exists (no drift)", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["reconcile", "--repo", dir], { cwd: dir })
  // No armada/state/ dir -> resume should exit 0 (no drift)
  assert.strictEqual(r.code, 0)
})

test("reconcile appears in help text", async () => {
  const r = await runCli(["help"])
  assert.match(r.stdout, /reconcile/)
})

// Fix 4: uninstall --all cleans armada/state/ and empty opencode/ dirs

test("uninstall --all removes armada/state directory", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  // Init to create armada files
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  // Simulate state left by feature new command
  mkdirSync(join(dir, "armada", "state", "features"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "active.json"), JSON.stringify({ feature: "test" }))
  writeFileSync(join(dir, "armada", "state", "features", "index.json"), JSON.stringify([]))
  // Uninstall --all --force (force needed because we created dirty state)
  const r = await runCli(["uninstall", "--all", "--force"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  // armada/state should be gone
  const { existsSync } = await import("node:fs")
  assert.ok(!existsSync(join(dir, "armada", "state")), "armada/state must be removed")
  assert.ok(!existsSync(join(dir, "armada")), "armada must be removed")
})

test("uninstall --all removes empty opencode dir left after cleanup", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  // Create a state dir that init doesn't touch
  mkdirSync(join(dir, "armada", "state"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "active.json"), JSON.stringify({ feature: "test" }))
  const r = await runCli(["uninstall", "--all", "--force"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const { existsSync } = await import("node:fs")
  assert.ok(!existsSync(join(dir, "armada")), "armada dir must be fully removed")
  assert.ok(!existsSync(join(dir, ".opencode")), ".opencode dir must be fully removed")
})

// Fix 5: doctor global binary check uses running binary, not PATH

test("doctor uses running binary for global armada check", async () => {
  const expectedVersion = "armada v0.9.2"
  const r = await runCli(["doctor"])
  // The global armada binary check should report from the running binary,
  // which always succeeds since we're running it.
  assert.match(r.stdout, /global armada binary: pass/)
  // Must report version from running binary, not stale PATH entry
  assert.match(r.stdout, new RegExp(`— ${expectedVersion.replace(/\./g, "\\.")}`))
})

// Fix 6: armada new --help rejects --help as project name

test("armada new --help prints help, not project named --help", async () => {
  const r = await runCli(["new", "--help"])
  // Must not create a project named --help
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
})

test("armada new with name starting with -- rejects with error", async () => {
  const r = await runCli(["new", "--weirdname"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /project name cannot start with --|invalid project name/i)
})
