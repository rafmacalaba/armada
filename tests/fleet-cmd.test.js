import { test } from "node:test"
import assert from "node:assert"

import { defaultRunEntry } from "../src/fleet-tracker.js"
import { renderFleetTable, renderFleetDetail, renderFleetJson, _padCell, _formatCost } from "../src/fleet-cmd.js"

// ---- fixtures --------------------------------------------------------------

function makeEntry(opts = {}) {
  return defaultRunEntry({
    session: "feat-stuff",
    cwd: "/tmp/sandbox/feat-stuff",
    branch: "feat/stuff",
    contractPath: "armada/REQUIREMENTS.md",
    ...opts,
  })
}

// ---- _padCell ---------------------------------------------------------------

test("_padCell pads short text to width", () => {
  assert.strictEqual(_padCell("hi", 5), "hi   ")
  assert.strictEqual(_padCell("hello", 5), "hello")
})

test("_padCell coerces non-strings", () => {
  assert.strictEqual(_padCell(42, 5), "42   ")
})

// ---- _formatCost ------------------------------------------------------------

test("_formatCost formats zero as 0", () => {
  assert.strictEqual(_formatCost(0), "0")
})

test("_formatCost formats positive values with dollar sign", () => {
  assert.strictEqual(_formatCost(0.12), "$0.12")
  assert.strictEqual(_formatCost(1.5), "$1.50")
})

// ---- renderFleetTable -------------------------------------------------------

test("renderFleetTable with empty list returns 'no active runs'", () => {
  const out = renderFleetTable([], { color: false })
  assert.strictEqual(out, "no active runs")
})

test("renderFleetTable with 3 entries contains header, session names, dashes", () => {
  const entries = [
    makeEntry({ session: "alpha", cwd: "/tmp/alpha", branch: "alpha-br" }),
    makeEntry({ session: "beta", cwd: "/tmp/beta", branch: "beta-br" }),
    makeEntry({ session: "gamma", cwd: "/tmp/gamma", branch: "gamma-br" }),
  ]
  const out = renderFleetTable(entries, { color: false })

  // Header
  assert.match(out, /SESSION/)
  assert.match(out, /LANE/)
  assert.match(out, /PHASE/)
  assert.match(out, /STATUS/)
  assert.match(out, /AGE/)
  assert.match(out, /COST/)

  // Dashes separator
  assert.match(out, /-{2,}/)

  // Session names
  assert.match(out, /alpha/)
  assert.match(out, /beta/)
  assert.match(out, /gamma/)

  // Order = input order (alpha, beta, gamma)
  const aIdx = out.indexOf("alpha")
  const bIdx = out.indexOf("beta")
  const gIdx = out.indexOf("gamma")
  assert.ok(aIdx < bIdx, "alpha before beta")
  assert.ok(bIdx < gIdx, "beta before gamma")

  // Reasonable padding: STATUS column should be at least 6 chars wide for "ACTIVE"
  assert.match(out, /ACTIVE\s/)
})

test("renderFleetTable with one STALLED entry shows STALLED verbatim", () => {
  const entry = makeEntry()
  // Make heartbeat stale so computeStaleness returns STALLED
  const threeMinAgo = new Date(Date.now() - 3 * 60_000).toISOString()
  entry.lastHeartbeatAt = threeMinAgo

  const out = renderFleetTable([entry], { color: false })
  assert.match(out, /STALLED/)
  assert.doesNotMatch(out, /ACTIVE/)
})

test("renderFleetTable with color: false contains no ANSI escape codes", () => {
  const entries = [makeEntry()]
  const out = renderFleetTable(entries, { color: false })
  assert.doesNotMatch(out, /\x1b\[/)
})

// ---- renderFleetJson --------------------------------------------------------

test("renderFleetJson with 2 entries returns valid JSON with documented keys, no tmuxPaneTail", () => {
  const entries = [
    makeEntry({ session: "a", cwd: "/tmp/a", branch: "br-a" }),
    makeEntry({ session: "b", cwd: "/tmp/b", branch: "br-b" }),
  ]
  const json = renderFleetJson(entries)
  const parsed = JSON.parse(json)

  assert.ok(Array.isArray(parsed))
  assert.strictEqual(parsed.length, 2)

  const requiredKeys = [
    "session", "lane", "branch", "contract", "phase",
    "status", "age", "cost", "startedAt", "lastHeartbeatAt",
    "lastNextAction", "evidenceCount",
  ]
  for (const row of parsed) {
    for (const key of requiredKeys) {
      assert.ok(key in row, `row must have key: ${key}`)
    }
    assert.ok(!("tmuxPaneTail" in row), "tmuxPaneTail must not be in JSON output")
  }

  assert.strictEqual(parsed[0].session, "a")
  assert.strictEqual(parsed[1].session, "b")
  // Verify expected keys present
  for (const key of ["session", "lane", "branch", "contract", "phase"]) {
    assert.ok(key in parsed[0])
  }
  assert.ok(!("tmuxPaneTail" in parsed[0]))
  assert.ok(!("tmuxPaneTail" in parsed[1]))
})

// ---- renderFleetDetail ------------------------------------------------------

test("renderFleetDetail with fully-populated entry contains every section", () => {
  const entry = makeEntry({
    session: "feat-x",
    cwd: "/tmp/feat-x",
    branch: "feat/x",
    contractPath: "armada/REQUIREMENTS.md",
    tmuxPaneTail: "line 1\nline 2\nline 3\n",
  })
  entry.lastNextAction = "write tests"
  entry.lastEvidence = ["ref1", "ref2"]
  entry.phaseStatuses = { p1: "passed", p2: "in_progress" }

  const out = renderFleetDetail(entry)

  assert.match(out, /Session: feat-x/)
  assert.match(out, /Lane: \/tmp\/feat-x\s+ Branch: feat\/x/)
  assert.match(out, /Contract: armada\/REQUIREMENTS\.md/)
  assert.match(out, /Status: \w+\s+ Age: \d/)
  assert.match(out, /Started:/)
  assert.match(out, /Last heartbeat:/)
  assert.match(out, /Last next action: write tests/)
  assert.match(out, /Last evidence: 2 refs/)
  assert.match(out, /Phase statuses: p1=passed, p2=in_progress/)
  assert.match(out, /--- pane tail ---/)
  assert.match(out, /line 1/)
  assert.match(out, /line 3/)
})

test("renderFleetDetail with minimal entry still produces output", () => {
  const entry = makeEntry({ tmuxPaneTail: "" })
  const out = renderFleetDetail(entry)

  assert.match(out, /Session: feat-stuff/)
  assert.match(out, /Lane:/)
  assert.match(out, /Contract:/)
  assert.match(out, /Last next action: -/)
  assert.match(out, /Last evidence: -/)
  assert.match(out, /Phase statuses: -/)
  assert.match(out, /--- pane tail ---/)
})
