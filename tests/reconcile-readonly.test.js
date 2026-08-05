import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, statSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { reconcile } from "../src/reconcile.js"

function writeJson(dir, rel, obj) {
  const full = join(dir, rel)
  mkdirSync(join(dir, rel, ".."), { recursive: true })
  writeFileSync(full, JSON.stringify(obj, null, 2) + "\n", "utf8")
}

function writeFile(dir, rel, content) {
  const full = join(dir, rel)
  mkdirSync(join(dir, rel, ".."), { recursive: true })
  writeFileSync(full, content, "utf8")
}

function snapshotDir(dir) {
  const entries = []
  try {
    const walk = (d) => {
      const items = readdirSync(d, { withFileTypes: true })
      for (const item of items) {
        const full = join(d, item.name)
        if (item.isDirectory()) {
          walk(full)
        } else {
          const stat = statSync(full)
          const content = readFileSync(full, "utf8")
          entries.push({ path: full, mtimeMs: stat.mtimeMs, content })
        }
      }
    }
    walk(dir)
  } catch { /* dir doesn't exist */ }
  entries.sort((a, b) => a.path.localeCompare(b.path))
  return JSON.stringify(entries)
}

test("reconcile is truly read-only: no file writes occur after any number of calls", () => {
  const dir = mkdtempSync(join(tmpdir(), "reconcile-ro-"))
  const stateDir = join(dir, "armada", "state")

  writeJson(stateDir, "active.json", {
    feature: "my-feat",
    contract: "armada/contracts/my-feat.md",
    phaseGraph: { phases: [] },
    evidence: [],
    nextAction: "",
    prUrl: null,
    updatedAt: "2026-01-01T00:00:00Z",
  })

  writeJson(stateDir, "features/index.json", [
    { name: "my-feat", status: "in_progress", contract: "armada/contracts/my-feat.md" },
  ])

  const snapBefore = snapshotDir(stateDir)

  // Run reconcile 50 times
  for (let i = 0; i < 50; i++) {
    reconcile(stateDir, dir)
  }

  const snapAfter = snapshotDir(stateDir)
  assert.strictEqual(snapAfter, snapBefore, "stateDir must be byte-identical after 50 reconcile calls")

  rmSync(dir, { recursive: true, force: true })
})

test("reconcile does not create any new files", () => {
  const dir = mkdtempSync(join(tmpdir(), "reconcile-no-create-"))
  const stateDir = join(dir, "armada", "state")

  writeJson(stateDir, "active.json", {
    feature: "f",
    contract: "c.md",
    phaseGraph: { phases: [] },
    evidence: [],
    nextAction: "",
    prUrl: null,
    updatedAt: "2026-01-01T00:00:00Z",
  })

  writeJson(stateDir, "features/index.json", [])

  // Count files before
  const snapBefore = snapshotDir(stateDir)
  const countBefore = JSON.parse(snapBefore).length

  reconcile(stateDir, dir)

  const snapAfter = snapshotDir(stateDir)
  const countAfter = JSON.parse(snapAfter).length
  assert.strictEqual(countAfter, countBefore, "no new files should be created in stateDir")

  rmSync(dir, { recursive: true, force: true })
})

test("reconcile with missing active.json returns no-op result and creates nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "reconcile-empty-"))
  const stateDir = join(dir, "armada", "state")
  mkdirSync(stateDir, { recursive: true })

  const beforeSnap = snapshotDir(stateDir)

  const plan = reconcile(stateDir, dir)
  assert.strictEqual(plan.activeFeature, null)
  assert.strictEqual(plan.currentPhase, null)
  assert.deepStrictEqual(plan.drifts, [])

  const afterSnap = snapshotDir(stateDir)
  assert.strictEqual(afterSnap, beforeSnap)

  rmSync(dir, { recursive: true, force: true })
})

test("reconcile makes no mutations even with corrupt state files", () => {
  const dir = mkdtempSync(join(tmpdir(), "reconcile-corrupt-"))
  const stateDir = join(dir, "armada", "state")

  // Write invalid JSON as active.json
  writeFile(dir, "armada/state/active.json", "not valid json {{{")

  const beforeSnap = snapshotDir(stateDir)

  const plan = reconcile(stateDir, dir)
  assert.strictEqual(plan.activeFeature, null, "corrupt active.json should not crash, should return no active")

  const afterSnap = snapshotDir(stateDir)
  assert.strictEqual(afterSnap, beforeSnap, "corrupt file must not be modified")

  rmSync(dir, { recursive: true, force: true })
})
