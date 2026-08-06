import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

// -- atomicity (from state-atomicity.test.js) --

test("writeAtomic writes file; reads the exact content back", async () => {
  const { writeAtomic, readSafe } = await import("../src/state/atomic.js")
  const dir = mkdtempSync(join(tmpdir(), "atomic-test-"))
  const filePath = join(dir, "state.json")
  const data = { version: 1, key: "value" }

  await writeAtomic(filePath, JSON.stringify(data))
  const raw = readSafe(filePath)
  assert.strictEqual(raw, JSON.stringify(data))
  rmSync(dir, { recursive: true, force: true })
})

test("writeAtomic never leaves a partial file", async () => {
  const { writeAtomic, readSafe } = await import("../src/state/atomic.js")
  const dir = mkdtempSync(join(tmpdir(), "atomic-test-"))
  const filePath = join(dir, "state.json")

  await writeAtomic(filePath, JSON.stringify({ v: 1 }))
  assert.strictEqual(readSafe(filePath), JSON.stringify({ v: 1 }))

  const before = readSafe(filePath)
  await writeAtomic(filePath, JSON.stringify({ v: 2 }))
  const after = readSafe(filePath)
  assert.notStrictEqual(after, before, "file content should change on successful write")
  assert.strictEqual(after, JSON.stringify({ v: 2 }))

  rmSync(dir, { recursive: true, force: true })
})

test("readSafe returns null for missing file", async () => {
  const { readSafe } = await import("../src/state/atomic.js")
  const result = readSafe("/nonexistent/path/state.json")
  assert.strictEqual(result, null)
})

test("concurrent writers: final state is consistent (one complete write)", async () => {
  const { writeAtomic, readSafe } = await import("../src/state/atomic.js")
  const dir = mkdtempSync(join(tmpdir(), "atomic-test-"))
  const filePath = join(dir, "state.json")

  const N = 10
  const writes = Array.from({ length: N }, (_, i) =>
    writeAtomic(filePath, JSON.stringify({ v: i }))
  )
  await Promise.all(writes)

  const raw = readSafe(filePath)
  const parsed = JSON.parse(raw)
  assert.ok(typeof parsed.v === "number", "v must be a number")
  assert.ok(parsed.v >= 0 && parsed.v < N, "v must be from one of the concurrent writes")
  assert.deepStrictEqual(Object.keys(parsed), ["v"], "no extra keys from corruption")
  rmSync(dir, { recursive: true, force: true })
})

// -- versioning (from state-versioning.test.js) --

test("STATE_VERSION is a positive integer", async () => {
  const { STATE_VERSION } = await import("../src/state/versioned.js")
  assert.strictEqual(typeof STATE_VERSION, "number")
  assert.ok(STATE_VERSION >= 1, "STATE_VERSION must be positive")
  assert.ok(Number.isInteger(STATE_VERSION), "STATE_VERSION must be an integer")
})

test("createVoyageState produces a valid state object with version", async () => {
  const { createVoyageState, STATE_VERSION } = await import("../src/state/versioned.js")
  const state = createVoyageState({
    voyage: "my-voyage",
    branch: "feat/my-voyage",
    worktree: "sandbox/my-voyage",
    contract: "armada/REQUIREMENTS.md",
  })
  assert.strictEqual(state.version, STATE_VERSION)
  assert.strictEqual(state.voyage, "my-voyage")
  assert.strictEqual(state.branch, "feat/my-voyage")
  assert.strictEqual(state.worktree, "sandbox/my-voyage")
  assert.strictEqual(state.contract, "armada/REQUIREMENTS.md")
  assert.strictEqual(state.status, "active")
  assert.deepStrictEqual(state.completedActions, [])
  assert.strictEqual(typeof state.createdAt, "string")
  assert.strictEqual(typeof state.updatedAt, "string")
})

test("recordAction returns new state with action appended, no duplicates", async () => {
  const { createVoyageState, recordAction } = await import("../src/state/versioned.js")
  const state = createVoyageState({ voyage: "test" })
  const s1 = recordAction(state, "init")
  assert.deepStrictEqual(s1.completedActions, ["init"])
  assert.strictEqual(s1.updatedAt > s1.createdAt || s1.updatedAt === s1.createdAt, true)
  assert.deepStrictEqual(state.completedActions, [])

  const s2 = recordAction(s1, "init")
  assert.deepStrictEqual(s2.completedActions, ["init"])
})

test("upgradeState handles older versions and returns current unchanged", async () => {
  const { createVoyageState, upgradeState, STATE_VERSION } = await import("../src/state/versioned.js")
  // older version gets upgraded
  const v0 = { voyage: "test", status: "active", completedActions: [] }
  const upgraded = upgradeState(v0)
  assert.strictEqual(typeof upgraded.version, "number")
  assert.ok(upgraded.version >= 1)
  assert.strictEqual(upgraded.voyage, "test")
  // current version returned unchanged
  const current = createVoyageState({ voyage: "test" })
  assert.deepStrictEqual(upgradeState(current), current)
})

test("validateVoyageState rejects invalid state", async () => {
  const { validateVoyageState } = await import("../src/state/versioned.js")
  assert.throws(() => validateVoyageState(null), /must be a plain object/)
  assert.throws(() => validateVoyageState({}), /voyage/)
  assert.throws(() => validateVoyageState({ voyage: "" }), /voyage/)
  assert.throws(() => validateVoyageState({ voyage: "x", version: "not-a-number" }), /version/)
})

test("validateVoyageState accepts valid state", async () => {
  const { createVoyageState, validateVoyageState } = await import("../src/state/versioned.js")
  const state = createVoyageState({ voyage: "test" })
  assert.doesNotThrow(() => validateVoyageState(state))
})

// -- lifecycle / exactly-once resume (from interrupt-exactly-once.test.js) --

test("recordCompletedAction tracks actions and is idempotent", async () => {
  const { createVoyageState, writeState, readState, recordCompletedAction } = await import("../src/voyage/lifecycle.js")
  const dir = mkdtempSync(join(tmpdir(), "lifecycle-"))
  const state = createVoyageState({ voyage: "test" })
  await writeState(dir, state)

  const afterRecord = await recordCompletedAction(dir, "phase-0-init")
  assert.deepStrictEqual(afterRecord.completedActions, ["phase-0-init"])

  const afterDup = await recordCompletedAction(dir, "phase-0-init")
  assert.deepStrictEqual(afterDup.completedActions, ["phase-0-init"])
  assert.deepStrictEqual(afterRecord, afterDup, "duplicate record must return same state")

  const afterSecond = await recordCompletedAction(dir, "phase-1-build")
  assert.deepStrictEqual(afterSecond.completedActions, ["phase-0-init", "phase-1-build"])

  rmSync(dir, { recursive: true, force: true })
})

test("resumeVoyage: skips completed actions, runs none if all done", async () => {
  const { createVoyageState, writeState, recordCompletedAction, resumeVoyage, readState } = await import("../src/voyage/lifecycle.js")

  // completed actions not re-executed
  const dir = mkdtempSync(join(tmpdir(), "lifecycle-"))
  const state = createVoyageState({ voyage: "test" })
  await writeState(dir, state)
  await recordCompletedAction(dir, "phase-0")

  const executed = []
  const handlers = {
    "phase-0": async () => { executed.push("phase-0") },
    "phase-1": async () => { executed.push("phase-1") },
    "phase-2": async () => { executed.push("phase-2") },
  }
  await resumeVoyage(dir, handlers)
  assert.strictEqual(executed.length, 2)
  assert.ok(!executed.includes("phase-0"))
  assert.ok(executed.includes("phase-1"))
  assert.ok(executed.includes("phase-2"))
  assert.deepStrictEqual(readState(dir).completedActions.sort(), ["phase-0", "phase-1", "phase-2"])
  rmSync(dir, { recursive: true, force: true })

  // no actions run if all completed
  const dir2 = mkdtempSync(join(tmpdir(), "lifecycle-"))
  const state2 = createVoyageState({ voyage: "test" })
  await writeState(dir2, state2)
  await recordCompletedAction(dir2, "phase-0")
  await recordCompletedAction(dir2, "phase-1")
  const executed2 = []
  const handlers2 = {
    "phase-0": async () => { executed2.push("phase-0") },
    "phase-1": async () => { executed2.push("phase-1") },
  }
  await resumeVoyage(dir2, handlers2)
  assert.deepStrictEqual(executed2, [])
  rmSync(dir2, { recursive: true, force: true })
})

test("resumeVoyage: marks state as interrupted on handler failure", async () => {
  const { createVoyageState, writeState, readState, resumeVoyage } = await import("../src/voyage/lifecycle.js")
  const dir = mkdtempSync(join(tmpdir(), "lifecycle-"))
  const state = createVoyageState({ voyage: "test" })
  await writeState(dir, state)

  const handlers = {
    "phase-0": async () => { throw new Error("simulated crash mid-voyage") },
    "phase-1": async () => {},
  }

  await assert.rejects(() => resumeVoyage(dir, handlers), /simulated crash/)

  const afterCrash = readState(dir)
  assert.strictEqual(afterCrash.status, "interrupted")
  assert.deepStrictEqual(afterCrash.completedActions, [])

  rmSync(dir, { recursive: true, force: true })
})
