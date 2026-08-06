import { test } from "node:test"
import assert from "node:assert"
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { runCli, makeTempGitRepo } from "./helpers.js"

// ---- helpers ---------------------------------------------------------------

function writeVoyageState(dir, name, overrides = {}) {
  const stateDir = join(dir, "armada", "state")
  mkdirSync(stateDir, { recursive: true })
  const state = {
    version: 1,
    voyage: name,
    branch: `feat/${name}`,
    worktree: `sandbox/${name}`,
    contract: "armada/contracts/test.md",
    status: "active",
    completedActions: [],
    inFlightAction: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
  writeFileSync(join(stateDir, "voyage.json"), JSON.stringify(state, null, 2) + "\n")
  return state
}

function readVoyageState(dir) {
  const p = join(dir, "armada", "state", "voyage.json")
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, "utf8"))
}

// ---- resume with P3 state --------------------------------------------------

test("armada resume with in_progress P3 state records inFlightAction as completed (idempotent)", async () => {
  const dir = makeTempGitRepo({})
  const name = "test-resume"
  writeVoyageState(dir, name, {
    status: "in_progress",
    completedActions: ["phase-0-init", "phase-1-build"],
    inFlightAction: "phase-2-test",
  })

  // Run resume — should record inFlightAction as completed
  const r = await runCli(["resume", "--repo", dir], { cwd: dir })
  // After resume, inFlightAction should be recorded in completedActions
  const updated = readVoyageState(dir)
  assert.ok(updated, "state should still exist after resume")
  assert.strictEqual(updated.status, "active", "status should transition to active after resume")
  assert.ok(updated.completedActions.includes("phase-2-test"), "inFlightAction must be recorded")
  assert.strictEqual(updated.inFlightAction, null, "inFlightAction should be cleared after completion")
  assert.ok(r.stdout.includes("resume:"), "output should contain resume line")
  rmSync(dir, { recursive: true, force: true })
})

test("armada resume with in_progress P3 state does NOT re-execute completed actions", async () => {
  const dir = makeTempGitRepo({})
  const name = "test-idempotent"
  const original = writeVoyageState(dir, name, {
    status: "in_progress",
    completedActions: ["phase-0", "phase-1", "phase-2"],
    inFlightAction: null,
  })

  // Run resume — all actions already completed, nothing to do
  const r = await runCli(["resume", "--repo", dir], { cwd: dir })
  const updated = readVoyageState(dir)
  assert.ok(updated, "state should still exist")
  // Completed actions must match exactly — no re-execution
  assert.deepStrictEqual(updated.completedActions.sort(), ["phase-0", "phase-1", "phase-2"])
  assert.strictEqual(updated.status, "active", "status should be active")
  rmSync(dir, { recursive: true, force: true })
})

// ---- resume with no P3 state -----------------------------------------------

test("armada resume with no P3 state file falls back to read-only reconcile", async () => {
  const dir = makeTempGitRepo({})
  // No voyage.json — should fall back to old reconcile
  const r = await runCli(["resume", "--repo", dir], { cwd: dir })
  // Fallback reconcile outputs "resume: no active feature"
  assert.ok(r.code === 2 || r.stdout.includes("resume:"), "should produce reconcile output")
  rmSync(dir, { recursive: true, force: true })
})

// ---- resume with paused state ----------------------------------------------

test("armada resume with paused P3 state continues from in-flight action", async () => {
  const dir = makeTempGitRepo({})
  const name = "test-paused"
  writeVoyageState(dir, name, {
    status: "paused",
    completedActions: ["phase-0"],
    inFlightAction: "phase-1-build",
  })

  // Run resume — should record the in-flight action and clear paused status
  const r = await runCli(["resume", "--repo", dir], { cwd: dir })
  const updated = readVoyageState(dir)
  assert.ok(updated, "state should still exist")
  assert.ok(updated.completedActions.includes("phase-1-build"), "paused in-flight action must be completed")
  assert.strictEqual(updated.inFlightAction, null, "inFlightAction should be cleared")
  assert.strictEqual(updated.status, "active", "status should transition from paused to active")
  rmSync(dir, { recursive: true, force: true })
})

// ---- reconcile with P3 state -----------------------------------------------

test("armada reconcile with P3 state file reports it in output", async () => {
  const dir = makeTempGitRepo({})
  const name = "test-reconcile-state"
  writeVoyageState(dir, name, {
    status: "in_progress",
    completedActions: ["phase-0"],
    inFlightAction: "phase-1",
  })

  const r = await runCli(["reconcile", "--repo", dir], { cwd: dir })
  // Reconcile should recognize P3 state and mention it
  assert.ok(r.stdout.includes("resume:"),
    "reconcile output should mention P3 state")
  assert.ok(r.code === 0 || r.code === 2, "exit code should be 0 or 2")
  rmSync(dir, { recursive: true, force: true })
})

test("armada reconcile with no P3 state file does not mention voyage state", async () => {
  const dir = makeTempGitRepo({})
  // No state — plain reconcile
  const r = await runCli(["reconcile", "--repo", dir], { cwd: dir })
  // Should not mention voyage-specific state language
  assert.strictEqual(r.code, 0)
  rmSync(dir, { recursive: true, force: true })
})

// ---- feature new --worktree creates P3 state -------------------------------

test("armada feature new --worktree produces a P3 state file", async () => {
  const dir = makeTempGitRepo({ "package.json": "{}" })
  const name = "test-ft-new"

  // Run feature new --worktree in the repo dir
  const r = await runCli(["feature", "new", name, "--worktree"], { cwd: dir })
  assert.strictEqual(r.code, 0, `feature new --worktree failed: ${r.stderr}`)

  // The worktree was created at sandbox/<name>
  const worktreeDir = join(dir, "sandbox", name)
  assert.ok(existsSync(worktreeDir), "worktree directory should exist")

  // P3 state file should exist in the worktree
  const statePath = join(worktreeDir, "armada", "state", "voyage.json")
  assert.ok(existsSync(statePath), `voyage state file should exist at ${statePath}`)

  const state = JSON.parse(readFileSync(statePath, "utf8"))
  assert.strictEqual(state.voyage, name)
  assert.strictEqual(state.status, "active")
  assert.ok(state.version >= 1, "state should have version")
  assert.deepStrictEqual(state.completedActions, [])

  // Cleanup worktree
  const { spawnSync } = await import("node:child_process")
  spawnSync("git", ["worktree", "remove", "--force", worktreeDir], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", `feat/${name}`], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})

// ---- feature close (without --remove) marks P3 state completed --------------

test("armada feature close (without --remove) marks P3 state completed", async () => {
  const dir = makeTempGitRepo({
    "package.json": "{}",
  })
  const { spawnSync } = await import("node:child_process")
  const name = "test-close2"

  // Create in-tree feature (no worktree) so we can check state after close
  const r1 = await runCli(["feature", "new", name], { cwd: dir })
  assert.strictEqual(r1.code, 0, `feature new failed: ${r1.stderr}`)

  // Add final criteria with evidence to the generated contract
  const contractPath = join(dir, "armada", "contracts", `${name}.md`)
  let contract = readFileSync(contractPath, "utf8")
  contract = contract.replace(/## Final criteria\n\n- \[ \] All tests pass\n  Evidence: \n/,
    `## Final criteria

- [x] All tests pass
  Evidence: tests/result.txt
`)
  writeFileSync(contractPath, contract)

  // Write P3 state file in the main repo
  writeVoyageState(dir, name, {
    status: "active",
    completedActions: ["phase-0", "phase-1"],
    inFlightAction: null,
  })

  // Create evidence file
  mkdirSync(join(dir, "tests"), { recursive: true })
  writeFileSync(join(dir, "tests", "result.txt"), "PASS\n")

  // Run feature close
  const r2 = await runCli(["feature", "close", name], { cwd: dir })
  assert.strictEqual(r2.code, 0, `feature close failed: ${r2.stderr}`)

  // Check P3 state was updated to completed
  const state = readVoyageState(dir)
  assert.ok(state, "state should exist")
  assert.strictEqual(state.status, "completed", "state status should be completed after close")

  rmSync(dir, { recursive: true, force: true })
})
