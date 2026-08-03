/**
 * Phase 2a — E2E tests for armada reconcile.
 *
 * Five scenarios proving the reconcile CLI against real filesystem state.
 * Engine not yet on disk — tests will fail until Phase 1 lands.
 *
 * Scenario 1 (happy path) exact resume line (from contract):
 *   resume: feature alpha, phase phase-2 (pending), evidence 1 in, drift 0, next start phase 2
 * Scenario 5 (no active feature) exact resume line:
 *   resume: no active feature
 */

import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"

const CLI = join(process.cwd(), "src", "cli.js")

// ---- helpers ----------------------------------------------------------------

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "armada-reconcile-"))
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8")
}

function mkdirp(dir) {
  mkdirSync(dir, { recursive: true })
}

/**
 * Spawn `node src/cli.js reconcile ...` and return { code, stdout, stderr }.
 */
function runReconcile(args) {
  const result = spawnSync(process.execPath, [CLI, "reconcile", ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
  })
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

/**
 * Parse JSON from stdout, returning null on parse failure.
 */
function tryParseJson(str) {
  try { return JSON.parse(str) } catch { return null }
}

// ---- state builders ---------------------------------------------------------

/**
 * Build a complete state dir + repo for scenario 1 (happy path).
 *
 * active.json: feature alpha, phase-1 passed, phase-2 pending.
 * Evidence file exists on disk.
 * Contract has phase-1 criteria ticked, phase-2 unticked.
 *
 * Exact resume line expected:
 *   resume: feature alpha, phase phase-2 (pending), evidence 1 in, drift 0, next start phase 2
 */
function buildHappyPath() {
  const repoRoot = makeTmpDir()
  const stateDir = join(repoRoot, "armada", "state")
  mkdirp(join(stateDir, "features"))
  mkdirp(join(repoRoot, "armada", "contracts"))
  mkdirp(join(repoRoot, "tests"))

  writeJson(join(stateDir, "active.json"), {
    feature: "alpha",
    contract: "armada/contracts/alpha.md",
    phaseGraph: {
      phases: [
        {
          id: "phase-1",
          title: "Implementation",
          dependsOn: [],
          status: "passed",
          criteria: [
            { id: "c1", text: "Tests pass", evidence: { kind: "test", ref: "tests/unit.test.js" } },
          ],
        },
        {
          id: "phase-2",
          title: "E2E",
          dependsOn: ["phase-1"],
          status: "pending",
          criteria: [
            { id: "c2", text: "E2E tests pass", evidence: null },
          ],
        },
      ],
    },
    evidence: [
      { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/unit.test.js" },
    ],
    nextAction: "start phase 2",
    updatedAt: "2026-08-03T00:00:00.000Z",
  })

  writeJson(join(stateDir, "features", "index.json"), [
    { name: "alpha", status: "in_progress", contract: "armada/contracts/alpha.md" },
  ])

  writeFileSync(
    join(repoRoot, "armada", "contracts", "alpha.md"),
    [
      "# alpha",
      "",
      "## phase-1 — Implementation",
      "",
      "- **Depends on:** none",
      "- **Goal:** Implementation",
      "- **Success criteria:**",
      "  - [x] Tests pass",
      "",
      "## phase-2 — E2E",
      "",
      "- **Depends on:** phase-1",
      "- **Goal:** E2E coverage",
      "- **Success criteria:**",
      "  - [ ] E2E tests pass",
      "",
    ].join("\n"),
    "utf8"
  )

  // Evidence file must exist on disk for the engine to validate.
  writeFileSync(join(repoRoot, "tests", "unit.test.js"), "// dummy", "utf8")

  return { repoRoot, stateDir }
}

/**
 * Scenario 2: evidence-missing.
 * Same state as happy path but the evidence file does NOT exist on disk.
 */
function buildEvidenceMissing() {
  const repoRoot = makeTmpDir()
  const stateDir = join(repoRoot, "armada", "state")
  mkdirp(join(stateDir, "features"))
  mkdirp(join(repoRoot, "armada", "contracts"))

  writeJson(join(stateDir, "active.json"), {
    feature: "alpha",
    contract: "armada/contracts/alpha.md",
    phaseGraph: {
      phases: [
        {
          id: "phase-1",
          title: "Implementation",
          dependsOn: [],
          status: "passed",
          criteria: [
            { id: "c1", text: "Tests pass", evidence: { kind: "test", ref: "tests/unit.test.js" } },
          ],
        },
      ],
    },
    evidence: [
      { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/unit.test.js" },
    ],
    nextAction: "",
    updatedAt: "2026-08-03T00:00:00.000Z",
  })

  writeJson(join(stateDir, "features", "index.json"), [
    { name: "alpha", status: "in_progress", contract: "armada/contracts/alpha.md" },
  ])

  writeFileSync(
    join(repoRoot, "armada", "contracts", "alpha.md"),
    [
      "# alpha",
      "",
      "## phase-1 — Implementation",
      "",
      "- **Depends on:** none",
      "- **Goal:** Implementation",
      "- **Success criteria:**",
      "  - [x] Tests pass",
      "",
    ].join("\n"),
    "utf8"
  )
  // NOTE: tests/unit.test.js is NOT created — evidence file is missing.

  return { repoRoot, stateDir }
}

/**
 * Scenario 3: criterion-unticked.
 * Phase-1 is "passed" in state, but the contract has one criterion still `- [ ]`.
 */
function buildCriterionUnticked() {
  const repoRoot = makeTmpDir()
  const stateDir = join(repoRoot, "armada", "state")
  mkdirp(join(stateDir, "features"))
  mkdirp(join(repoRoot, "armada", "contracts"))
  mkdirp(join(repoRoot, "tests"))

  writeJson(join(stateDir, "active.json"), {
    feature: "alpha",
    contract: "armada/contracts/alpha.md",
    phaseGraph: {
      phases: [
        {
          id: "phase-1",
          title: "Implementation",
          dependsOn: [],
          status: "passed",
          criteria: [
            { id: "c1", text: "Tests pass", evidence: { kind: "test", ref: "tests/unit.test.js" } },
            { id: "c2", text: "Coverage above 80%", evidence: { kind: "test", ref: "tests/unit.test.js" } },
          ],
        },
      ],
    },
    evidence: [
      { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/unit.test.js" },
    ],
    nextAction: "",
    updatedAt: "2026-08-03T00:00:00.000Z",
  })

  writeJson(join(stateDir, "features", "index.json"), [
    { name: "alpha", status: "in_progress", contract: "armada/contracts/alpha.md" },
  ])

  // Contract: c1 is ticked [x], c2 is still [ ] — but state says phase-1 is passed.
  writeFileSync(
    join(repoRoot, "armada", "contracts", "alpha.md"),
    [
      "# alpha",
      "",
      "## phase-1 — Implementation",
      "",
      "- **Depends on:** none",
      "- **Goal:** Implementation",
      "- **Success criteria:**",
      "  - [x] Tests pass",
      "  - [ ] Coverage above 80%",
      "",
    ].join("\n"),
    "utf8"
  )

  writeFileSync(join(repoRoot, "tests", "unit.test.js"), "// dummy", "utf8")

  return { repoRoot, stateDir }
}

/**
 * Scenario 4: evidence-failed.
 * Evidence file exists on disk but its content contains failure markers.
 * Engine reads file content and detects FAIL / "not ok" / etc.
 */
function buildEvidenceFailed() {
  const repoRoot = makeTmpDir()
  const stateDir = join(repoRoot, "armada", "state")
  mkdirp(join(stateDir, "features"))
  mkdirp(join(repoRoot, "armada", "contracts"))
  mkdirp(join(repoRoot, "tests"))

  writeJson(join(stateDir, "active.json"), {
    feature: "alpha",
    contract: "armada/contracts/alpha.md",
    phaseGraph: {
      phases: [
        {
          id: "phase-1",
          title: "Implementation",
          dependsOn: [],
          status: "in_progress",
          criteria: [
            { id: "c1", text: "Tests pass", evidence: { kind: "test", ref: "tests/unit.test.js" } },
          ],
        },
      ],
    },
    evidence: [
      { phase: "phase-1", criterion: "c1", kind: "test", ref: "tests/unit.test.js" },
    ],
    nextAction: "",
    updatedAt: "2026-08-03T00:00:00.000Z",
  })

  writeJson(join(stateDir, "features", "index.json"), [
    { name: "alpha", status: "in_progress", contract: "armada/contracts/alpha.md" },
  ])

  writeFileSync(
    join(repoRoot, "armada", "contracts", "alpha.md"),
    [
      "# alpha",
      "",
      "## phase-1 — Implementation",
      "",
      "- **Depends on:** none",
      "- **Goal:** Implementation",
      "- **Success criteria:**",
      "  - [ ] Tests pass",
      "",
    ].join("\n"),
    "utf8"
  )

  // Evidence file contains failure markers that the engine detects.
  writeFileSync(
    join(repoRoot, "tests", "unit.test.js"),
    "not ok 1 - should pass\n# fail 1\n",
    "utf8"
  )

  return { repoRoot, stateDir }
}

/**
 * Scenario 5: no active feature.
 * Empty state dir — no active.json.
 *
 * Exact resume line expected:
 *   resume: no active feature
 */
function buildNoActiveFeature() {
  const repoRoot = makeTmpDir()
  const stateDir = join(repoRoot, "armada", "state")
  mkdirp(join(stateDir, "features"))

  // No active.json written — this is the scenario.
  // Write an empty features index for completeness.
  writeJson(join(stateDir, "features", "index.json"), [])

  return { repoRoot, stateDir }
}

// ---- tests ------------------------------------------------------------------

/**
 * Scenario 1: happy path — feature alpha, phase-1 passed, phase-2 pending.
 *
 * Exact resume line from contract:
 *   resume: feature alpha, phase phase-2 (pending), evidence 1 in, drift 0, next start phase 2
 */
test("reconcile: happy path — exit 0, resume line, no drifts", () => {
  const { repoRoot, stateDir } = buildHappyPath()

  const result = runReconcile([
    "--json",
    "--state-dir", stateDir,
    "--repo", repoRoot,
  ])

  assert.strictEqual(result.code, 0, `expected exit 0, got ${result.code}; stderr: ${result.stderr}`)

  const plan = tryParseJson(result.stdout)
  assert.ok(plan, `stdout must be valid JSON; got: ${result.stdout.slice(0, 200)}`)

  // ResumePlan shape
  assert.strictEqual(plan.activeFeature, "alpha")
  assert.ok(plan.currentPhase, "currentPhase must be present")
  assert.deepStrictEqual(plan.drifts, [], "drifts must be empty")
  assert.ok(typeof plan.resumeLine === "string", "resumeLine must be a string")
  assert.ok(plan.generatedAt, "generatedAt must be present")

  // Resume line matches contract pattern
  assert.match(
    plan.resumeLine,
    /^resume: feature alpha, phase phase-2 \(pending\), evidence 1 in, drift 0, next .+/,
    "resume line must match contract pattern"
  )

  // Stdout has no drift lines (no "drift" or "evidence-missing" text)
  assert.doesNotMatch(result.stdout, /evidence-missing/, "stdout must not contain drift lines")
  assert.doesNotMatch(result.stdout, /evidence-failed/, "stdout must not contain drift lines")
  assert.doesNotMatch(result.stdout, /criterion-unticked/, "stdout must not contain drift lines")
})

/**
 * Scenario 2: evidence-missing — evidence file path does not exist on disk.
 * CLI exits 2; JSON drifts[0].kind === "evidence-missing".
 */
test("reconcile: evidence-missing — exit 2, drift kind", () => {
  const { repoRoot, stateDir } = buildEvidenceMissing()

  const result = runReconcile([
    "--json",
    "--state-dir", stateDir,
    "--repo", repoRoot,
  ])

  assert.strictEqual(result.code, 2, `expected exit 2, got ${result.code}; stderr: ${result.stderr}`)

  const plan = tryParseJson(result.stdout)
  assert.ok(plan, `stdout must be valid JSON; got: ${result.stdout.slice(0, 200)}`)

  assert.ok(Array.isArray(plan.drifts), "drifts must be an array")
  assert.ok(plan.drifts.length > 0, "must have at least one drift")
  assert.strictEqual(plan.drifts[0].kind, "evidence-missing", "first drift kind must be evidence-missing")
})

/**
 * Scenario 3: criterion-unticked — phase marked passed in state but contract has unticked criterion.
 * CLI exits 2; JSON drifts[0].kind === "criterion-unticked".
 */
test("reconcile: criterion-unticked — exit 2, drift kind", () => {
  const { repoRoot, stateDir } = buildCriterionUnticked()

  const result = runReconcile([
    "--json",
    "--state-dir", stateDir,
    "--repo", repoRoot,
  ])

  assert.strictEqual(result.code, 2, `expected exit 2, got ${result.code}; stderr: ${result.stderr}`)

  const plan = tryParseJson(result.stdout)
  assert.ok(plan, `stdout must be valid JSON; got: ${result.stdout.slice(0, 200)}`)

  assert.ok(Array.isArray(plan.drifts), "drifts must be an array")
  assert.ok(plan.drifts.length > 0, "must have at least one drift")
  assert.strictEqual(plan.drifts[0].kind, "criterion-unticked", "first drift kind must be criterion-unticked")
})

/**
 * Scenario 4: evidence-failed — evidence entry has exitCode !== 0.
 * CLI exits 2; JSON drifts[0].kind === "evidence-failed".
 */
test("reconcile: evidence-failed — exit 2, drift kind", () => {
  const { repoRoot, stateDir } = buildEvidenceFailed()

  const result = runReconcile([
    "--json",
    "--state-dir", stateDir,
    "--repo", repoRoot,
  ])

  assert.strictEqual(result.code, 2, `expected exit 2, got ${result.code}; stderr: ${result.stderr}`)

  const plan = tryParseJson(result.stdout)
  assert.ok(plan, `stdout must be valid JSON; got: ${result.stdout.slice(0, 200)}`)

  assert.ok(Array.isArray(plan.drifts), "drifts must be an array")
  assert.ok(plan.drifts.length > 0, "must have at least one drift")
  assert.strictEqual(plan.drifts[0].kind, "evidence-failed", "first drift kind must be evidence-failed")
})

/**
 * Scenario 5: no active feature — empty state dir, no active.json.
 *
 * Exact resume line expected:
 *   resume: no active feature
 */
test("reconcile: no active feature — exit 0, resume no-active-feature", () => {
  const { repoRoot, stateDir } = buildNoActiveFeature()

  const result = runReconcile([
    "--json",
    "--state-dir", stateDir,
    "--repo", repoRoot,
  ])

  assert.strictEqual(result.code, 0, `expected exit 0, got ${result.code}; stderr: ${result.stderr}`)

  const plan = tryParseJson(result.stdout)
  assert.ok(plan, `stdout must be valid JSON; got: ${result.stdout.slice(0, 200)}`)

  // Resume line for no active feature
  assert.ok(typeof plan.resumeLine === "string", "resumeLine must be a string")
  assert.match(
    plan.resumeLine,
    /resume: no active feature/i,
    "resume line must indicate no active feature"
  )

  // activeFeature should be null or absent
  assert.ok(
    plan.activeFeature === null || plan.activeFeature === undefined,
    "activeFeature must be null or absent when no active feature"
  )
})
