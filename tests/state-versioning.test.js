import { test } from "node:test"
import assert from "node:assert"

// Failing test: state/versioned.js does not exist yet
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
  // Original not mutated
  assert.deepStrictEqual(state.completedActions, [])

  // Duplicate: record same action again, should be idempotent
  const s2 = recordAction(s1, "init")
  assert.deepStrictEqual(s2.completedActions, ["init"])
})

test("upgradeState handles older versions", async () => {
  const { upgradeState } = await import("../src/state/versioned.js")
  // v0 state (no version field)
  const v0 = { voyage: "test", status: "active", completedActions: [] }
  const upgraded = upgradeState(v0)
  assert.strictEqual(typeof upgraded.version, "number")
  assert.ok(upgraded.version >= 1)
  assert.strictEqual(upgraded.voyage, "test")
})

test("upgradeState returns current version unchanged", async () => {
  const { createVoyageState, upgradeState, STATE_VERSION } = await import("../src/state/versioned.js")
  const current = createVoyageState({ voyage: "test" })
  const result = upgradeState(current)
  assert.deepStrictEqual(result, current)
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
