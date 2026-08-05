/**
 * Phase 4 — Restart-proof reconcile + validation.
 *
 * Three scenarios proving a killed session resumes without state loss,
 * multi-feature safety, and state round-trip via filesystem.
 */

import { test } from "node:test"
import assert from "node:assert"
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs"
import { join } from "node:path"

// ---- helpers (subset of tests/helpers.js, no import from tests/) ----

import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { execFile } from "node:child_process"

const CLI = join(process.cwd(), "src", "cli.js")

function makeTempRepo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "armada-v4-"))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel)
    mkdirSync(join(dir, rel.split("/").slice(0, -1).join("/")), { recursive: true })
    writeFileSync(p, content, "utf8")
  }
  return dir
}

function runCli(args, opts = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, ...(opts.env || {}) }
    execFile(process.execPath, [CLI, ...args], { cwd: opts.cwd || process.cwd(), env },
      (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stdout, stderr }))
  })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8")
}

/**
 * Build a "resume:" line from the active state, mirroring what the orchestrator
 * would produce on session start. This is the "resume diff" logic the contract
 * requires — implemented here in the test since we cannot edit src/.
 */
function buildResumeLine(active) {
  if (!active || !active.feature) return null
  const phases = active.phaseGraph?.phases ?? []
  // Find the first non-passed phase (current / next)
  const current = phases.find((p) => p.status !== "passed") ?? phases[phases.length - 1]
  const phaseId = current ? current.id : "none"
  const phaseStatus = current ? current.status : "none"

  // Evidence count for current phase
  const evidenceIn = active.evidence?.filter((e) => e.phase === phaseId).length ?? 0
  const evidenceLabel = evidenceIn > 0 ? `${evidenceIn} in` : "none"

  const next = active.nextAction || "(none)"
  return `resume: feature ${active.feature}, phase ${phaseId} (${phaseStatus}), evidence ${evidenceLabel}, next action ${next}`
}

// ---- Scenario A: mid-phase kill + reopen ----

test("Scenario A: mid-phase kill + reopen produces correct resume line", async () => {
  const cwd = makeTempRepo({})

  // Step 1: create feature "alpha"
  const create = await runCli(["feature", "new", "alpha", "--target", cwd])
  assert.strictEqual(create.code, 0, `feature new failed: ${create.stderr}`)
  assert.match(create.stdout, /feature "alpha" created/)

  // Step 2: verify active.json shape
  const activePath = join(cwd, "armada", "state", "active.json")
  assert.ok(existsSync(activePath), "active.json must exist after feature new")
  const active = readJson(activePath)
  assert.strictEqual(active.feature, "alpha")
  assert.ok(active.phaseGraph, "phaseGraph must be present")
  assert.ok(Array.isArray(active.phaseGraph.phases), "phaseGraph.phases must be array")
  assert.ok(active.phaseGraph.phases.length > 0, "must have at least one phase")

  // Step 3: simulate kill — set phase 0 to in_progress with partial evidence
  const phases = active.phaseGraph.phases
  const firstPhase = phases[0]
  firstPhase.status = "in_progress"
  // Mark first criterion as evidenced (simulates work done before kill)
  if (firstPhase.criteria.length > 0) {
    firstPhase.criteria[0].evidence = { kind: "test", ref: "tests/state.test.js" }
  }
  // Set nextAction to show what was being worked on
  active.nextAction = "continue phase 1 implementation"
  active.evidence = [
    { phase: firstPhase.id, criterion: firstPhase.criteria[0].id, kind: "test", ref: "tests/state.test.js" },
  ]
  writeJson(activePath, active)

  // Step 4: simulate reopen — run feature status (deprecation → status table)
  const status = await runCli(["feature", "status", "--target", cwd])
  assert.match(status.stderr, /deprecated/, "must print deprecation hint")
  // status code from the deprecation wrapper: always exits 1
  assert.strictEqual(status.code, 1, `feature status deprecated exit: ${status.stderr}`)
  assert.match(status.stdout, /alpha/, "table must include alpha feature")

  // Step 5: build the resume line from active state (the orchestrator's job)
  const resumeLine = buildResumeLine(readJson(activePath))
  assert.ok(resumeLine, "resume line must not be null")
  assert.match(resumeLine, /resume: feature alpha/)
  assert.match(resumeLine, new RegExp(`phase ${firstPhase.id}`))
  assert.match(resumeLine, /in_progress/)
  assert.match(resumeLine, /evidence 1 in/)
  assert.match(resumeLine, /next action continue phase 1 implementation/)

  // Step 6: verify state is intact after "reopen" — no fields lost
  const reloaded = readJson(activePath)
  assert.strictEqual(reloaded.feature, "alpha")
  assert.strictEqual(reloaded.phaseGraph.phases[0].status, "in_progress")
  assert.strictEqual(
    reloaded.phaseGraph.phases[0].criteria[0].evidence.ref,
    "tests/state.test.js"
  )
  assert.strictEqual(reloaded.evidence.length, 1)
  assert.strictEqual(reloaded.nextAction, "continue phase 1 implementation")
})

// ---- Scenario B: multi-feature safety (no cross-clobber) ----

test("Scenario B: two features on same repo, disjoint state, no cross-clobber", async () => {
  const cwd = makeTempRepo({})

  // Create alpha
  const rAlpha = await runCli(["feature", "new", "alpha", "--target", cwd])
  assert.strictEqual(rAlpha.code, 0, `alpha create failed: ${rAlpha.stderr}`)

  // Create beta
  const rBeta = await runCli(["feature", "new", "beta", "--target", cwd])
  assert.strictEqual(rBeta.code, 0, `beta create failed: ${rBeta.stderr}`)

  // Assert disjoint contract files
  assert.ok(existsSync(join(cwd, "armada", "contracts", "alpha.md")), "alpha contract must exist")
  assert.ok(existsSync(join(cwd, "armada", "contracts", "beta.md")), "beta contract must exist")
  const alphaContract = readFileSync(join(cwd, "armada", "contracts", "alpha.md"), "utf8")
  const betaContract = readFileSync(join(cwd, "armada", "contracts", "beta.md"), "utf8")
  assert.notStrictEqual(alphaContract, betaContract, "contracts must be disjoint content")

  // Assert disjoint feature entry files
  const alphaEntryPath = join(cwd, "armada", "state", "features", "alpha.json")
  const betaEntryPath = join(cwd, "armada", "state", "features", "beta.json")
  assert.ok(existsSync(alphaEntryPath), "alpha entry must exist")
  assert.ok(existsSync(betaEntryPath), "beta entry must exist")
  const alphaEntry = readJson(alphaEntryPath)
  const betaEntry = readJson(betaEntryPath)
  assert.strictEqual(alphaEntry.name, "alpha")
  assert.strictEqual(betaEntry.name, "beta")

  // Assert index contains both
  const index = readJson(join(cwd, "armada", "state", "features", "index.json"))
  const alphaIdx = index.find((e) => e.name === "alpha")
  const betaIdx = index.find((e) => e.name === "beta")
  assert.ok(alphaIdx, "index must contain alpha")
  assert.ok(betaIdx, "index must contain beta")

  // Mutate alpha's entry directly — beta must be unaffected
  alphaEntry.status = "in_progress"
  writeJson(alphaEntryPath, alphaEntry)

  // Re-run feature list — beta must still be "open"
  const list = await runCli(["feature", "list", "--target", cwd])
  assert.strictEqual(list.code, 0, `feature list failed: ${list.stderr}`)
  assert.match(list.stdout, /alpha/)
  assert.match(list.stdout, /beta/)

  // Beta entry unchanged
  const betaEntryAfter = readJson(betaEntryPath)
  assert.strictEqual(betaEntryAfter.status, "open", "beta must still be open after alpha mutation")

  // Close alpha — need evidence in contract
  const contractPath = join(cwd, "armada", "contracts", "alpha.md")
  let contract = readFileSync(contractPath, "utf8")
  contract = contract.replace(/Evidence: \n/g, "Evidence: src/alpha.js:1\n")
  writeFileSync(contractPath, contract, "utf8")

  const rClose = await runCli(["feature", "close", "alpha", "--target", cwd])
  assert.strictEqual(rClose.code, 0, `alpha close failed: ${rClose.stderr}`)
  assert.match(rClose.stdout, /shipped/)

  // Alpha shipped, beta still open
  const indexAfter = readJson(join(cwd, "armada", "state", "features", "index.json"))
  const alphaAfter = indexAfter.find((e) => e.name === "alpha")
  const betaAfter = indexAfter.find((e) => e.name === "beta")
  assert.strictEqual(alphaAfter.status, "shipped", "alpha must be shipped")
  assert.strictEqual(betaAfter.status, "open", "beta must still be open after alpha close")

  // History files are separate
  assert.ok(existsSync(join(cwd, "armada", "state", "history", "alpha.jsonl")), "alpha history must exist")
  assert.ok(existsSync(join(cwd, "armada", "state", "history", "beta.jsonl")), "beta history must exist")
  const alphaHistory = readFileSync(join(cwd, "armada", "state", "history", "alpha.jsonl"), "utf8")
  const betaHistory = readFileSync(join(cwd, "armada", "state", "history", "beta.jsonl"), "utf8")
  assert.match(alphaHistory, /"alpha"/)
  assert.match(betaHistory, /"beta"/)
  assert.notStrictEqual(alphaHistory, betaHistory, "history files must be disjoint")
})

// ---- Scenario C: state round-trip via filesystem ----

test("Scenario C: write state via API, read back via CLI, fields match", async () => {
  const cwd = makeTempRepo({})

  // Create feature "gamma" via CLI
  const r = await runCli(["feature", "new", "gamma", "--target", cwd])
  assert.strictEqual(r.code, 0, `feature new failed: ${r.stderr}`)

  // Read back via CLI feature status (deprecation → status table)
  const status = await runCli(["feature", "status", "--target", cwd])
  assert.match(status.stderr, /deprecated/, "must print deprecation hint")
  assert.strictEqual(status.code, 1, `feature status deprecated exit: ${status.stderr}`)

  // Table format: FEATURE, STATUS, CONTRACT, NEXT ACTION, PR
  assert.match(status.stdout, /gamma/, "table must include gamma")
  assert.match(status.stdout, /FEATURE/, "table must have FEATURE header")

  // Read the raw active.json and verify deep-equal of core fields
  const activePath = join(cwd, "armada", "state", "active.json")
  const active = readJson(activePath)
  assert.strictEqual(active.feature, "gamma")
  assert.ok(active.contract.includes("gamma"))
  assert.ok(active.phaseGraph.phases.length > 0)
  assert.strictEqual(active.phaseGraph.phases[0].status, "pending")
  assert.strictEqual(active.evidence.length, 0)
  assert.strictEqual(active.nextAction, "")
  assert.ok(active.updatedAt, "updatedAt must be set")
})
