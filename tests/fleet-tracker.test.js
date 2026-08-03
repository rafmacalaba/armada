import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, statSync } from "node:fs"
import { mkdir, readFile, readdir as readDir } from "node:fs/promises"
import { resolve, join } from "node:path"
import { tmpdir } from "node:os"

import {
  defaultRunEntry,
  validateRunEntry,
  computeStaleness,
  computeAgeMs,
  computeElapsed,
  summarizeRun,
  getStoreDir,
  writeRun,
  readRun,
  listRuns,
  updateRun,
} from "../src/fleet-tracker.js"

// ---- fixtures -------------------------------------------------------------

function makeEntry(opts = {}) {
  return defaultRunEntry({
    session: "feat-stuff",
    cwd: "/tmp/sandbox/feat-stuff",
    branch: "feat/stuff",
    contractPath: "armada/REQUIREMENTS.md",
    ...opts,
  })
}

function tmpStoreDir() {
  return mkdtempSync(join(tmpdir(), "armada-runs-"))
}

// ---- defaultRunEntry -------------------------------------------------------

test("defaultRunEntry returns well-shaped object with expected defaults", () => {
  const entry = makeEntry()
  validateRunEntry(entry)

  assert.strictEqual(entry.session, "feat-stuff")
  assert.strictEqual(entry.lane, "/tmp/sandbox/feat-stuff")
  assert.strictEqual(entry.branch, "feat/stuff")
  assert.strictEqual(entry.contract, "armada/REQUIREMENTS.md")
  assert.strictEqual(typeof entry.startedAt, "string")
  assert.strictEqual(entry.startedAt, entry.lastHeartbeatAt)
  assert.strictEqual(entry.lastNextAction, "")
  assert.deepStrictEqual(entry.lastEvidence, [])
  assert.deepStrictEqual(entry.phaseStatuses, {})
  assert.strictEqual(entry.tmuxPaneTail, "")
  assert.strictEqual(entry.cost, 0)
  assert.strictEqual(entry.status, "ACTIVE")
})

test("defaultRunEntry accepts tmuxPaneTail override", () => {
  const entry = makeEntry({ tmuxPaneTail: "pane content" })
  assert.strictEqual(entry.tmuxPaneTail, "pane content")
})

test("defaultRunEntry throws on missing required params", () => {
  assert.throws(() => defaultRunEntry({}), /session: must be a non-empty string/)
})

// ---- validateRunEntry ------------------------------------------------------

test("validateRunEntry accepts a good entry", () => {
  const entry = makeEntry()
  validateRunEntry(entry)
  assert.ok(true)
})

test("validateRunEntry throws on missing session", () => {
  const entry = makeEntry()
  delete entry.session
  assert.throws(() => validateRunEntry(entry), /entry\.session: must be a non-empty string/)
})

test("validateRunEntry throws on empty session", () => {
  const entry = makeEntry()
  entry.session = ""
  assert.throws(() => validateRunEntry(entry), /entry\.session: must be a non-empty string/)
})

test("validateRunEntry throws on missing lane", () => {
  const entry = makeEntry()
  delete entry.lane
  assert.throws(() => validateRunEntry(entry), /entry\.lane: must be a non-empty string/)
})

test("validateRunEntry throws on missing branch", () => {
  const entry = makeEntry()
  delete entry.branch
  assert.throws(() => validateRunEntry(entry), /entry\.branch: must be a non-empty string/)
})

test("validateRunEntry throws on missing contract", () => {
  const entry = makeEntry()
  delete entry.contract
  assert.throws(() => validateRunEntry(entry), /entry\.contract: must be a non-empty string/)
})

test("validateRunEntry throws on missing startedAt", () => {
  const entry = makeEntry()
  delete entry.startedAt
  assert.throws(() => validateRunEntry(entry), /entry\.startedAt: must be a non-empty string/)
})

test("validateRunEntry throws on missing lastHeartbeatAt", () => {
  const entry = makeEntry()
  delete entry.lastHeartbeatAt
  assert.throws(() => validateRunEntry(entry), /entry\.lastHeartbeatAt: must be a non-empty string/)
})

test("validateRunEntry throws on missing tmuxPaneTail string", () => {
  const entry = makeEntry()
  delete entry.tmuxPaneTail
  assert.throws(() => validateRunEntry(entry), /entry\.tmuxPaneTail: must be a string/)
})

test("validateRunEntry throws on invalid phaseStatuses value", () => {
  const entry = makeEntry()
  entry.phaseStatuses = { p1: "done" }
  assert.throws(() => validateRunEntry(entry), /must be one of pending\|in_progress\|passed/)
})

test("validateRunEntry throws when phaseStatuses is not an object", () => {
  const entry = makeEntry()
  entry.phaseStatuses = "nope"
  assert.throws(() => validateRunEntry(entry), /entry\.phaseStatuses: must be a plain object/)
})

test("validateRunEntry throws on invalid status", () => {
  const entry = makeEntry()
  entry.status = "UNKNOWN"
  assert.throws(() => validateRunEntry(entry), /entry\.status: must be one of ACTIVE\|STALLED/)
})

test("validateRunEntry throws on non-number cost", () => {
  const entry = makeEntry()
  entry.cost = "free"
  assert.throws(() => validateRunEntry(entry), /entry\.cost: must be a number/)
})

test("validateRunEntry throws on non-array lastEvidence", () => {
  const entry = makeEntry()
  entry.lastEvidence = "nope"
  assert.throws(() => validateRunEntry(entry), /entry\.lastEvidence: must be an array/)
})

test("validateRunEntry throws when entry is null", () => {
  assert.throws(() => validateRunEntry(null), /entry: must be a plain object/)
})

test("validateRunEntry throws when entry is array", () => {
  assert.throws(() => validateRunEntry([]), /entry: must be a plain object/)
})

// ---- computeStaleness ------------------------------------------------------

test("computeStaleness: recent heartbeat -> ACTIVE", () => {
  const entry = makeEntry()
  const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString()
  entry.lastHeartbeatAt = sixtySecondsAgo
  assert.strictEqual(computeStaleness(entry, { staleMs: 2 * 60_000 }), "ACTIVE")
})

test("computeStaleness: stale heartbeat -> STALLED", () => {
  const entry = makeEntry()
  const threeMinAgo = new Date(Date.now() - 3 * 60_000).toISOString()
  entry.lastHeartbeatAt = threeMinAgo
  assert.strictEqual(computeStaleness(entry, { staleMs: 2 * 60_000 }), "STALLED")
})

test("computeStaleness: exactly at threshold -> ACTIVE", () => {
  const entry = makeEntry()
  const exactlyStale = new Date(Date.now() - 2 * 60_000).toISOString()
  entry.lastHeartbeatAt = exactlyStale
  assert.strictEqual(computeStaleness(entry, { staleMs: 2 * 60_000 }), "ACTIVE")
})

// ---- computeAgeMs ----------------------------------------------------------

test("computeAgeMs returns positive ms", () => {
  const entry = makeEntry()
  const past = new Date(Date.now() - 5_000).toISOString()
  entry.startedAt = past
  const age = computeAgeMs(entry)
  assert.ok(age >= 5_000)
})

test("computeAgeMs clamps at 0 for future timestamps", () => {
  const entry = makeEntry()
  const future = new Date(Date.now() + 60_000).toISOString()
  entry.startedAt = future
  assert.strictEqual(computeAgeMs(entry), 0)
})

// ---- computeElapsed --------------------------------------------------------

test("computeElapsed: 0ms -> 0s", () => {
  const entry = makeEntry()
  const now = new Date(entry.startedAt).getTime()
  assert.strictEqual(computeElapsed(entry, { now }), "0s")
})

test("computeElapsed: 65_000ms -> 1m 5s", () => {
  const entry = makeEntry()
  const now = new Date(entry.startedAt).getTime() + 65_000
  assert.strictEqual(computeElapsed(entry, { now }), "1m 5s")
})

test("computeElapsed: 3_661_000ms -> 1h 1m", () => {
  const entry = makeEntry()
  const now = new Date(entry.startedAt).getTime() + 3_661_000
  assert.strictEqual(computeElapsed(entry, { now }), "1h 1m")
})

test("computeElapsed: exactly 3600000ms -> 1h 0m", () => {
  const entry = makeEntry()
  const now = new Date(entry.startedAt).getTime() + 3_600_000
  assert.strictEqual(computeElapsed(entry, { now }), "1h 0m")
})

// ---- summarizeRun ----------------------------------------------------------

test("summarizeRun returns expected shape", () => {
  const entry = makeEntry()
  const summary = summarizeRun(entry)
  assert.strictEqual(summary.session, "feat-stuff")
  assert.strictEqual(summary.lane, "/tmp/sandbox/feat-stuff")
  assert.strictEqual(summary.branch, "feat/stuff")
  assert.strictEqual(summary.status, "ACTIVE")
  assert.strictEqual(summary.cost, 0)
  assert.strictEqual(typeof summary.age, "string")
})

test("summarizeRun phase: first in_progress wins", () => {
  const entry = makeEntry()
  entry.phaseStatuses = { p1: "pending", p2: "in_progress", p3: "in_progress" }
  assert.strictEqual(summarizeRun(entry).phase, "p2")
})

test("summarizeRun phase: fallback to last passed", () => {
  const entry = makeEntry()
  entry.phaseStatuses = { p1: "passed", p2: "passed", p3: "pending" }
  assert.strictEqual(summarizeRun(entry).phase, "p2")
})

test("summarizeRun phase: no in_progress or passed -> dash", () => {
  const entry = makeEntry()
  entry.phaseStatuses = { p1: "pending", p2: "pending" }
  assert.strictEqual(summarizeRun(entry).phase, "-")
})

test("summarizeRun phase: empty phaseStatuses -> dash", () => {
  const entry = makeEntry()
  assert.strictEqual(summarizeRun(entry).phase, "-")
})

// ---- writeRun + readRun round-trip -----------------------------------------

test("writeRun + readRun round-trips", async () => {
  const storeDir = tmpStoreDir()
  await mkdir(storeDir, { recursive: true })

  const entry = makeEntry()
  await writeRun(entry, { storeDir })

  const read = await readRun("feat-stuff", { storeDir })
  assert.deepStrictEqual(read, entry)
})

test("readRun returns null for missing session", async () => {
  const storeDir = tmpStoreDir()
  await mkdir(storeDir, { recursive: true })

  const result = await readRun("nonexistent", { storeDir })
  assert.strictEqual(result, null)
})

test("readRun returns null when store dir is empty", async () => {
  const storeDir = tmpStoreDir()
  await mkdir(storeDir, { recursive: true })

  const result = await readRun("anything", { storeDir })
  assert.strictEqual(result, null)
})

// ---- listRuns --------------------------------------------------------------

test("listRuns: empty dir -> []", async () => {
  const storeDir = tmpStoreDir()
  await mkdir(storeDir, { recursive: true })

  const runs = await listRuns({ storeDir })
  assert.deepStrictEqual(runs, [])
})

test("listRuns: three entries sorted by startedAt desc", async () => {
  const storeDir = tmpStoreDir()
  await mkdir(storeDir, { recursive: true })

  const base = Date.now()
  const entries = [
    // newest
    makeEntry({ session: "c", cwd: "/c", branch: "c", contractPath: "c.md" }),
    makeEntry({ session: "b", cwd: "/b", branch: "b", contractPath: "b.md" }),
    makeEntry({ session: "a", cwd: "/a", branch: "a", contractPath: "a.md" }),
  ]
  entries[0].startedAt = new Date(base - 1_000).toISOString()       // 1s ago
  entries[0].lastHeartbeatAt = entries[0].startedAt
  entries[1].startedAt = new Date(base - 5_000).toISOString()       // 5s ago
  entries[1].lastHeartbeatAt = entries[1].startedAt
  entries[2].startedAt = new Date(base - 10_000).toISOString()      // 10s ago
  entries[2].lastHeartbeatAt = entries[2].startedAt

  for (const e of entries) {
    await writeRun(e, { storeDir })
  }

  const runs = await listRuns({ storeDir })
  assert.strictEqual(runs.length, 3)
  assert.strictEqual(runs[0].session, "c") // newest first
  assert.strictEqual(runs[1].session, "b")
  assert.strictEqual(runs[2].session, "a") // oldest last
})

// ---- updateRun -------------------------------------------------------------

test("updateRun patches fields and persists", async () => {
  const storeDir = tmpStoreDir()
  await mkdir(storeDir, { recursive: true })

  const entry = makeEntry()
  await writeRun(entry, { storeDir })

  const merged = await updateRun("feat-stuff", {
    lastNextAction: "write tests",
    tmuxPaneTail: "tail content",
  }, { storeDir })

  assert.strictEqual(merged.lastNextAction, "write tests")
  assert.strictEqual(merged.tmuxPaneTail, "tail content")
  // original fields preserved
  assert.strictEqual(merged.session, "feat-stuff")

  // verify persistence
  const reloaded = await readRun("feat-stuff", { storeDir })
  assert.strictEqual(reloaded.lastNextAction, "write tests")
  assert.strictEqual(reloaded.tmuxPaneTail, "tail content")
})

test("updateRun throws when session not found", async () => {
  const storeDir = tmpStoreDir()
  await mkdir(storeDir, { recursive: true })

  await assert.rejects(
    () => updateRun("nonexistent", { lastNextAction: "x" }, { storeDir }),
    /updateRun: session "nonexistent" not found/,
  )
})

// ---- atomic write ----------------------------------------------------------

test("writeRun is atomic: no .tmp file left behind", async () => {
  const storeDir = tmpStoreDir()
  await mkdir(storeDir, { recursive: true })

  const entry = makeEntry()
  const writtenPath = await writeRun(entry, { storeDir })

  assert.ok(writtenPath.endsWith(".json"))
  assert.ok(!writtenPath.includes(".tmp"))

  // verify no .tmp files in the directory
  const files = await readDir(storeDir)
  for (const f of files) {
    assert.ok(!f.endsWith(".tmp"), `unexpected tmp file: ${f}`)
  }
})

test("getStoreDir returns a path and creates it", () => {
  const dir = getStoreDir()
  assert.strictEqual(typeof dir, "string")
  assert.doesNotThrow(() => statSync(dir))
})
