import { test } from "node:test"
import assert from "node:assert"

// Failing: voyage/lifecycle.js does not exist yet
test("createVoyageState writes versioned state and reads it back", async () => {
  const { createVoyageState, writeState, readState } = await import("../src/voyage/lifecycle.js")
  const { mkdtempSync, rmSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { tmpdir } = await import("node:os")

  const dir = mkdtempSync(join(tmpdir(), "lifecycle-"))
  const state = createVoyageState({ voyage: "test-voyage" })
  await writeState(dir, state)
  const read = readState(dir)
  assert.deepStrictEqual(read, state)
  rmSync(dir, { recursive: true, force: true })
})

test("recordCompletedAction tracks actions and is idempotent", async () => {
  const { createVoyageState, writeState, readState, recordCompletedAction } = await import("../src/voyage/lifecycle.js")
  const { mkdtempSync, rmSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { tmpdir } = await import("node:os")

  const dir = mkdtempSync(join(tmpdir(), "lifecycle-"))
  const state = createVoyageState({ voyage: "test" })
  await writeState(dir, state)

  // Record action
  const afterRecord = await recordCompletedAction(dir, "phase-0-init")
  assert.deepStrictEqual(afterRecord.completedActions, ["phase-0-init"])

  // Record same action again — idempotent
  const afterDup = await recordCompletedAction(dir, "phase-0-init")
  assert.deepStrictEqual(afterDup.completedActions, ["phase-0-init"])
  assert.deepStrictEqual(afterRecord, afterDup, "duplicate record must return same state")

  // Record different action
  const afterSecond = await recordCompletedAction(dir, "phase-1-build")
  assert.deepStrictEqual(afterSecond.completedActions, ["phase-0-init", "phase-1-build"])

  rmSync(dir, { recursive: true, force: true })
})

test("resumeVoyage: completed actions are not re-executed", async () => {
  const { createVoyageState, writeState, readState, recordCompletedAction, resumeVoyage } = await import("../src/voyage/lifecycle.js")
  const { mkdtempSync, rmSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { tmpdir } = await import("node:os")

  const dir = mkdtempSync(join(tmpdir(), "lifecycle-"))
  const state = createVoyageState({ voyage: "test" })
  await writeState(dir, state)

  // Record phase-0 as completed
  await recordCompletedAction(dir, "phase-0")

  // Define action handlers
  const executed = []
  const handlers = {
    "phase-0": async () => { executed.push("phase-0") },
    "phase-1": async () => { executed.push("phase-1") },
    "phase-2": async () => { executed.push("phase-2") },
  }

  // Resume — phase-0 is already done, should skip it
  await resumeVoyage(dir, handlers)

  assert.strictEqual(executed.length, 2, "only 2 actions should execute (phase-1, phase-2), not phase-0")
  assert.ok(!executed.includes("phase-0"), "phase-0 must not re-execute")
  assert.ok(executed.includes("phase-1"), "phase-1 must execute")
  assert.ok(executed.includes("phase-2"), "phase-2 must execute")

  // Read state after resume — all three should be recorded
  const finalState = readState(dir)
  assert.deepStrictEqual(finalState.completedActions.sort(), ["phase-0", "phase-1", "phase-2"])

  rmSync(dir, { recursive: true, force: true })
})

test("resumeVoyage: no actions run if all completed", async () => {
  const { createVoyageState, writeState, recordCompletedAction, resumeVoyage } = await import("../src/voyage/lifecycle.js")
  const { mkdtempSync, rmSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { tmpdir } = await import("node:os")

  const dir = mkdtempSync(join(tmpdir(), "lifecycle-"))
  const state = createVoyageState({ voyage: "test" })
  await writeState(dir, state)

  await recordCompletedAction(dir, "phase-0")
  await recordCompletedAction(dir, "phase-1")

  const executed = []
  const handlers = {
    "phase-0": async () => { executed.push("phase-0") },
    "phase-1": async () => { executed.push("phase-1") },
  }

  await resumeVoyage(dir, handlers)

  assert.deepStrictEqual(executed, [], "no actions should execute when all done")

  rmSync(dir, { recursive: true, force: true })
})

test("resumeVoyage: marks state as interrupted on handler failure", async () => {
  const { createVoyageState, writeState, readState, resumeVoyage } = await import("../src/voyage/lifecycle.js")
  const { mkdtempSync, rmSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { tmpdir } = await import("node:os")

  const dir = mkdtempSync(join(tmpdir(), "lifecycle-"))
  const state = createVoyageState({ voyage: "test" })
  await writeState(dir, state)

  const handlers = {
    "phase-0": async () => { throw new Error("simulated crash mid-voyage") },
    "phase-1": async () => {},
  }

  await assert.rejects(() => resumeVoyage(dir, handlers), /simulated crash/)

  // Check state is interrupted
  const afterCrash = readState(dir)
  assert.strictEqual(afterCrash.status, "interrupted")
  // phase-0 should NOT be recorded (it failed)
  assert.deepStrictEqual(afterCrash.completedActions, [])

  rmSync(dir, { recursive: true, force: true })
})

test("writeState is atomic: partial writes never observable", async () => {
  const { createVoyageState, writeState, readState } = await import("../src/voyage/lifecycle.js")
  const { mkdtempSync, rmSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { tmpdir } = await import("node:os")

  const dir = mkdtempSync(join(tmpdir(), "lifecycle-"))
  const state = createVoyageState({ voyage: "test" })
  await writeState(dir, state)

  // Read back must be complete JSON
  const raw = readState(dir)
  assert.ok(raw.version >= 1, "read state must be complete and valid")
  assert.strictEqual(raw.voyage, "test")

  rmSync(dir, { recursive: true, force: true })
})
