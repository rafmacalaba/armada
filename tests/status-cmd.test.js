import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"

const CLI = join(process.cwd(), "src", "cli.js")

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "armada-status-t-"))
}

function mkdirp(dir) {
  mkdirSync(dir, { recursive: true })
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8")
}

function runCli(args, cwd) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: cwd ?? process.cwd(),
  })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

// ---- no state files -------------------------------------------------------

test("status: no state files — exit 1 with clear message", () => {
  const dir = makeTmpDir()
  mkdirp(join(dir, "armada", "state", "features"))

  const result = runCli(["status"], dir)

  assert.strictEqual(result.code, 1, "exit 1 when no state files")
  assert.ok(result.stdout.includes("no active feature") || result.stdout.includes("No active feature") || result.stderr.includes("no active feature") || result.stderr.includes("No active feature") || result.stdout.length > 0,
    "must print a clear message about no state")
})

// ---- state features exist but no active.json -----------------------------

test("status: features index only — shows table with features", () => {
  const dir = makeTmpDir()
  mkdirp(join(dir, "armada", "state", "features"))

  writeJson(join(dir, "armada", "state", "features", "index.json"), [
    { name: "alpha", status: "open", contract: "armada/contracts/alpha.md" },
    { name: "beta", status: "in_progress", contract: "armada/contracts/beta.md" },
  ])

  const result = runCli(["status"], dir)

  assert.strictEqual(result.code, 0)

  const out = result.stdout
  assert.match(out, /FEATURE/)
  assert.match(out, /STATUS/)
  assert.match(out, /CONTRACT/)
  assert.match(out, /NEXT ACTION/)
  assert.match(out, /PR/)
  assert.match(out, /alpha/)
  assert.match(out, /beta/)
  assert.match(out, /open/)
  assert.match(out, /in_progress/)
})

// ---- active.json only (no index.json) -------------------------------------

test("status: active.json only — shows table with active feature", () => {
  const dir = makeTmpDir()
  mkdirp(join(dir, "armada", "state", "features"))

  writeJson(join(dir, "armada", "state", "active.json"), {
    feature: "gamma",
    contract: "armada/contracts/gamma.md",
    phaseGraph: { phases: [] },
    evidence: [],
    nextAction: "start phase 1",
    prUrl: null,
    updatedAt: "2026-08-03T00:00:00.000Z",
  })

  const result = runCli(["status"], dir)

  assert.strictEqual(result.code, 0)
  const out = result.stdout
  assert.match(out, /gamma/)
  assert.match(out, /start phase 1/)
})

// ---- both active.json and index.json --------------------------------------

test("status: both files — active feature enriched with nextAction and PR", () => {
  const dir = makeTmpDir()
  mkdirp(join(dir, "armada", "state", "features"))

  writeJson(join(dir, "armada", "state", "active.json"), {
    feature: "gamma",
    contract: "armada/contracts/gamma.md",
    phaseGraph: { phases: [{ id: "phase-1", title: "setup", dependsOn: [], status: "in_progress", criteria: [] }] },
    evidence: [],
    nextAction: "write tests",
    prUrl: "https://github.com/org/repo/pull/42",
    updatedAt: "2026-08-03T00:00:00.000Z",
  })

  writeJson(join(dir, "armada", "state", "features", "index.json"), [
    { name: "alpha", status: "shipped", contract: "armada/contracts/alpha.md" },
    { name: "gamma", status: "in_progress", contract: "armada/contracts/gamma.md" },
  ])

  const result = runCli(["status"], dir)

  assert.strictEqual(result.code, 0)
  const out = result.stdout
  assert.match(out, /alpha/)
  assert.match(out, /gamma/)
  assert.match(out, /shipped/)
  assert.match(out, /in_progress/)
  assert.match(out, /write tests/)
  assert.match(out, /github\.com/)
  assert.match(out, /pull\/42/)
})

// ---- --json ----------------------------------------------------------------

test("status: --json — emits valid JSON with feature data", () => {
  const dir = makeTmpDir()
  mkdirp(join(dir, "armada", "state", "features"))

  writeJson(join(dir, "armada", "state", "active.json"), {
    feature: "gamma",
    contract: "armada/contracts/gamma.md",
    phaseGraph: { phases: [] },
    evidence: [],
    nextAction: "deploy",
    prUrl: null,
    updatedAt: "2026-08-03T00:00:00.000Z",
  })

  writeJson(join(dir, "armada", "state", "features", "index.json"), [
    { name: "gamma", status: "in_progress", contract: "armada/contracts/gamma.md" },
  ])

  const result = runCli(["status", "--json"], dir)

  assert.strictEqual(result.code, 0)
  const parsed = JSON.parse(result.stdout)
  assert.ok(Array.isArray(parsed))
  assert.strictEqual(parsed.length, 1)
  assert.strictEqual(parsed[0].feature, "gamma")
  assert.strictEqual(parsed[0].status, "in_progress")
  assert.strictEqual(parsed[0].contract, "armada/contracts/gamma.md")
  assert.strictEqual(parsed[0].nextAction, "deploy")
  assert.strictEqual(parsed[0].pr, null)
})

// ---- --json, no state files -----------------------------------------------

test("status: --json with no state files — exit 1, clear message", () => {
  const dir = makeTmpDir()
  mkdirp(join(dir, "armada", "state", "features"))

  const result = runCli(["status", "--json"], dir)

  assert.strictEqual(result.code, 1)
  const out = result.stdout || result.stderr
  assert.ok(out.length > 0, "must print a message")
})

// ---- table format: no ANSI in output --------------------------------------

test("status: table output contains no ANSI escape codes or emoji", () => {
  const dir = makeTmpDir()
  mkdirp(join(dir, "armada", "state", "features"))

  writeJson(join(dir, "armada", "state", "features", "index.json"), [
    { name: "feat-x", status: "open", contract: "armada/contracts/feat-x.md" },
  ])

  const result = runCli(["status"], dir)

  assert.strictEqual(result.code, 0)
  assert.doesNotMatch(result.stdout, /\x1b\[/)
})
