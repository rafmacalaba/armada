import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { makeTempGitRepo, runCli } from "./helpers.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"

function manifestYaml(budget = "free") {
  const m = {
    project: { name: "e2e", budget, browserTesting: false, devcontainer: false, useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, budget), fallback: null, enabled: true })),
  }
  return renderManifestYaml(m, buildTeam(m))
}

// Unit tests for refuseDirtyCleanup / hasDirtyState
test("refuseDirtyCleanup: throws when state has unshipped artefacts", async () => {
  const { refuseDirtyCleanup } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  mkdirSync(join(dir, "armada", "state", "features"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "features", "pending.json"), JSON.stringify({ name: "pending", status: "open" }))
  mkdirSync(join(dir, "armada", "state", "history"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "history", "ship.jsonl"), "{\"event\":\"created\"}\n")

  assert.throws(() => refuseDirtyCleanup(dir), /unshipped|dirty state/i)
  rmSync(dir, { recursive: true, force: true })
})

test("refuseDirtyCleanup: with force=true does not throw on dirty state", async () => {
  const { refuseDirtyCleanup } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  mkdirSync(join(dir, "armada", "state", "features"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "features", "pending.json"), JSON.stringify({ name: "pending", status: "open" }))

  assert.doesNotThrow(() => refuseDirtyCleanup(dir, { force: true }))
  rmSync(dir, { recursive: true, force: true })
})

test("refuseDirtyCleanup: does not throw on clean state", async () => {
  const { refuseDirtyCleanup } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  assert.doesNotThrow(() => refuseDirtyCleanup(dir))
  rmSync(dir, { recursive: true, force: true })
})

test("hasDirtyState: returns true when state dir has feature entries", async () => {
  const { hasDirtyState } = await import("../src/voyage/isolation.js")
  const dir = mkdtempSync(join(tmpdir(), "dirtytest-"))
  mkdirSync(join(dir, "armada", "state", "features"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "features", "any.json"), "{}")

  assert.strictEqual(hasDirtyState(dir), true)
  rmSync(dir, { recursive: true, force: true })
})

test("hasDirtyState: returns false when no state exists", async () => {
  const { hasDirtyState } = await import("../src/voyage/isolation.js")
  const dir = mkdtempSync(join(tmpdir(), "cleantest-"))
  assert.strictEqual(hasDirtyState(dir), false)
  rmSync(dir, { recursive: true, force: true })
})

// DEF-005 e2e: uninstall --all with unshipped features should refuse unless --force.
test("uninstall --all with unshipped feature refuses and exits non-zero", async () => {
  const dir = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })

  mkdirSync(join(dir, "armada", "state", "features"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "features", "unshipped.json"), JSON.stringify({ name: "unshipped", status: "open" }))
  writeFileSync(join(dir, "armada", "state", "active.json"), JSON.stringify({ feature: "unshipped" }))

  const r = await runCli(["uninstall", "--all"], { cwd: dir })
  assert.notStrictEqual(r.code, 0, "uninstall --all with dirty state should refuse")
  assert.match(r.stderr, /dirty|unshipped|refus/i, "should mention dirty state")

  const { existsSync: ex } = await import("node:fs")
  assert.ok(ex(join(dir, "armada", "state")), "state must still exist after refused uninstall")
  assert.ok(ex(join(dir, "armada", "armada.yaml")), "armada.yaml must still exist")
})

test("uninstall --all --force with unshipped feature succeeds", async () => {
  const dir = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })

  mkdirSync(join(dir, "armada", "state", "features"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "features", "unshipped.json"), JSON.stringify({ name: "unshipped", status: "open" }))
  writeFileSync(join(dir, "armada", "state", "active.json"), JSON.stringify({ feature: "unshipped" }))

  const r = await runCli(["uninstall", "--all", "--force"], { cwd: dir })
  assert.strictEqual(r.code, 0, "uninstall --all --force should succeed")

  const { existsSync: ex } = await import("node:fs")
  assert.ok(!ex(join(dir, "armada")), "armada dir should be removed with --force")
})

test("uninstall --all with clean state succeeds", async () => {
  const dir = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })

  const r = await runCli(["uninstall", "--all"], { cwd: dir })
  assert.strictEqual(r.code, 0, "uninstall --all with clean state should succeed")
})
