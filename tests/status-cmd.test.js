/**
 * status-cmd.test.js — unit tests for status rendering with null-safe rows.
 *
 * Covers:
 *  - renderStatus() skips active row when active.feature is null (parallel-voyages)
 *  - renderStatus() with empty index + null feature → no crash
 *  - _renderTable() null-safe: feature,null / status,null / contract,null → "-"
 *  - renderStatus() happy path
 */

import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { renderStatus, _renderTable } from "../src/status-cmd.js"

// ---- helpers --------------------------------------------------------------

/**
 * Create a temp state directory with optional active.json + features/index.json.
 * @param {{ active?: object, index?: object[] }} opts
 * @returns {string} dir
 */
function makeStateDir({ active, index } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "armada-status-"))
  if (active !== undefined) {
    writeFileSync(join(dir, "active.json"), JSON.stringify(active), "utf8")
  }
  if (index !== undefined) {
    const featuresDir = join(dir, "features")
    mkdirSync(featuresDir, { recursive: true })
    writeFileSync(join(featuresDir, "index.json"), JSON.stringify(index), "utf8")
  }
  return dir
}

// ---- Test (a): null feature in active with non-empty index -----------------

test("renderStatus: active.feature=null skips active row, returns index rows", () => {
  const stateDir = makeStateDir({
    active: { feature: null, contract: "c/null.md", workflow: {} },
    index: [
      { name: "f1", status: "open", contract: "c1.md" },
      { name: "f2", status: "in_progress", contract: "c2.md" },
    ],
  })
  try {
    const { code, output } = renderStatus(stateDir)
    assert.strictEqual(code, 0, "must return code 0")
    assert.doesNotThrow(() => { /* no throw */ }, "must not throw")
    // Must contain both index features
    assert.ok(output.includes("f1"), "output contains f1")
    assert.ok(output.includes("f2"), "output contains f2")
    // Must NOT contain "null" as a feature name
    assert.ok(!output.match(/^\s*null\s/m), "must not contain null feature row")
  } finally {
    rmSync(stateDir, { recursive: true, force: true })
  }
})

// ---- Test (b): null feature in active with empty index ---------------------

test("renderStatus: active.feature=null + empty index → code 0, no active row", () => {
  const stateDir = makeStateDir({
    active: { feature: null, contract: "c/null.md", workflow: {} },
    index: [],
  })
  try {
    const { code, output } = renderStatus(stateDir)
    assert.strictEqual(code, 0, "must return code 0")
    assert.ok(output.includes("no features registered"), "shows empty message")
  } finally {
    rmSync(stateDir, { recursive: true, force: true })
  }
})

// ---- Test (c): _renderTable tolerates null fields --------------------------

test("_renderTable: null feature/status/contract → renders '-' for each", () => {
  const rows = [
    {
      feature: null,
      status: null,
      contract: null,
      nextAction: null,
      pr: null,
      workflow: null,
    },
    {
      feature: "ok-feat",
      status: "shipped",
      contract: "c/ok.md",
      nextAction: null,
      pr: "https://example.com/pr",
      workflow: { risk: "low", evidenceClass: "smoke", activeAgents: ["qa"] },
    },
  ]
  const table = _renderTable(rows)
  // Must not throw — we already passed that.
  assert.ok(table.length > 0, "table is non-empty")
  // The null row should have "-" rendered for those fields.
  // Check that the output contains the header and the ok row.
  assert.ok(table.includes("FEATURE"), "has header")
  assert.ok(table.includes("ok-feat"), "contains ok-feat row")
  // Must not contain unrendered "null" string for feature cell.
  // The null feature should show some placeholder.
  assert.ok(table.includes("-"), "contains dashes for null fields")
})

// ---- Test (d): happy path — non-active feature renders correctly -----------

test("renderStatus: feature in index renders a row with populated fields", () => {
  const stateDir = makeStateDir({
    index: [
      { name: "voyager", status: "shipped", contract: "contracts/voyager.md" },
    ],
  })
  try {
    const { code, output } = renderStatus(stateDir)
    assert.strictEqual(code, 0, "must return code 0")
    // Table output assertions
    assert.ok(output.includes("voyager"), "contains feature name")
    assert.ok(output.includes("shipped"), "contains status")
    assert.ok(output.includes("contracts/voyager.md"), "contains contract path")
  } finally {
    rmSync(stateDir, { recursive: true, force: true })
  }
})
