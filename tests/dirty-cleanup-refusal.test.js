import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { makeTempGitRepo } from "./helpers.js"

test("refuseDirtyCleanup: throws when state has unshipped artefacts", async () => {
  const { refuseDirtyCleanup } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  // Create some state files that look like unshipped work
  const stateDir = join(dir, "armada", "state")
  const { mkdirSync: mkdir } = await import("node:fs")
  mkdir(join(dir, "armada", "state", "features"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "features", "pending.json"), JSON.stringify({ name: "pending", status: "open" }))
  mkdir(join(dir, "armada", "state", "history"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "history", "ship.jsonl"), "{\"event\":\"created\"}\n")

  assert.throws(() => refuseDirtyCleanup(dir), /unshipped|dirty state/i)
  rmSync(dir, { recursive: true, force: true })
})

test("refuseDirtyCleanup: with force=true does not throw on dirty state", async () => {
  const { refuseDirtyCleanup } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  const { mkdirSync: mkdir } = await import("node:fs")
  mkdir(join(dir, "armada", "state", "features"), { recursive: true })
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
  const { mkdirSync: mkdir } = await import("node:fs")
  mkdir(join(dir, "armada", "state", "features"), { recursive: true })
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
