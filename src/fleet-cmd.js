/**
 * Fleet command — per-lane progress dashboard rendering.
 *
 * Pure rendering — no I/O. Reads data passed in.
 *
 * @module fleet-cmd
 */

import { computeStaleness, summarizeRun, computeElapsed } from "./fleet-tracker.js"

const ANSI_GREEN = "\x1b[32m"
const ANSI_YELLOW = "\x1b[33m"
const ANSI_RESET = "\x1b[0m"

// ---- public API ------------------------------------------------------------

/**
 * Render a table of fleet runs.
 * Columns: SESSION | LANE | PHASE | STATUS | AGE | COST.
 * @param {object[]} entries - run entries from fleet-tracker
 * @param {{ now?: number, staleMs?: number, color?: boolean }} [opts]
 * @returns {string}
 */
export function renderFleetTable(entries, { now = Date.now(), staleMs = 2 * 60 * 1000, color = process.stderr.isTTY } = {}) {
  if (entries.length === 0) return "no active runs"

  const rows = entries.map((entry) => {
    const status = computeStaleness(entry, { now, staleMs })
    const summary = summarizeRun(entry)
    const elapsed = computeElapsed(entry, { now })
    return {
      session: summary.session,
      lane: summary.lane,
      phase: summary.phase,
      status,
      age: elapsed,
      cost: summary.cost,
    }
  })

  // Compute column widths from data and header labels
  const widths = {
    session: Math.max(7, ...rows.map((r) => r.session.length)),
    lane: Math.max(4, ...rows.map((r) => r.lane.length)),
    phase: Math.max(5, ...rows.map((r) => r.phase.length)),
    status: Math.max(6, ...rows.map((r) => r.status.length)),
    age: Math.max(3, ...rows.map((r) => r.age.length)),
    cost: Math.max(4, ...rows.map((r) => _formatCost(r.cost).length)),
  }

  const headerRow = [
    _padCell("SESSION", widths.session),
    _padCell("LANE", widths.lane),
    _padCell("PHASE", widths.phase),
    _padCell("STATUS", widths.status),
    _padCell("AGE", widths.age),
    _padCell("COST", widths.cost),
  ].join("  ")

  const separator = [
    "-".repeat(widths.session),
    "-".repeat(widths.lane),
    "-".repeat(widths.phase),
    "-".repeat(widths.status),
    "-".repeat(widths.age),
    "-".repeat(widths.cost),
  ].join("  ")

  const dataRows = rows.map((row) => {
    // Pad raw text first, then wrap with ANSI so alignment stays correct.
    const statusRaw = _padCell(row.status, widths.status)
    let statusCol = statusRaw
    if (color) {
      if (row.status === "ACTIVE") statusCol = `${ANSI_GREEN}${statusRaw}${ANSI_RESET}`
      else if (row.status === "STALLED") statusCol = `${ANSI_YELLOW}${statusRaw}${ANSI_RESET}`
    }

    return [
      _padCell(row.session, widths.session),
      _padCell(row.lane, widths.lane),
      _padCell(row.phase, widths.phase),
      statusCol,
      _padCell(row.age, widths.age),
      _padCell(_formatCost(row.cost), widths.cost),
    ].join("  ")
  })

  return [headerRow, separator, ...dataRows].join("\n")
}

/**
 * Render a detailed view of a single fleet run.
 * @param {object} entry - run entry from fleet-tracker
 * @param {{ now?: number }} [opts]
 * @returns {string}
 */
export function renderFleetDetail(entry, { now = Date.now() } = {}) {
  const status = computeStaleness(entry, { now })
  const elapsed = computeElapsed(entry, { now })
  const phaseList = Object.entries(entry.phaseStatuses)
    .map(([id, s]) => `${id}=${s}`)
    .join(", ") || "-"
  const evidence = entry.lastEvidence.length > 0
    ? `${entry.lastEvidence.length} refs`
    : "-"
  const tail = entry.tmuxPaneTail || ""
  const tailLines = tail ? tail.split("\n").slice(-20).join("\n") : ""

  return `Session: ${entry.session}
Lane: ${entry.lane}  Branch: ${entry.branch}
Contract: ${entry.contract}
Status: ${status}  Age: ${elapsed}
Started: ${entry.startedAt}
Last heartbeat: ${entry.lastHeartbeatAt}
Last next action: ${entry.lastNextAction || "-"}
Last evidence: ${evidence}
Phase statuses: ${phaseList}
--- pane tail ---
${tailLines}`
}

/**
 * Render fleet runs as a JSON array (concise, no tmuxPaneTail).
 * @param {object[]} entries - run entries from fleet-tracker
 * @returns {string} JSON string
 */
export function renderFleetJson(entries) {
  const rows = entries.map((entry) => {
    const status = computeStaleness(entry)
    const summary = summarizeRun(entry)
    const elapsed = computeElapsed(entry)
    return {
      session: entry.session,
      lane: entry.lane,
      branch: entry.branch,
      contract: entry.contract,
      phase: summary.phase,
      status,
      age: elapsed,
      cost: entry.cost,
      startedAt: entry.startedAt,
      lastHeartbeatAt: entry.lastHeartbeatAt,
      lastNextAction: entry.lastNextAction,
      evidenceCount: entry.lastEvidence.length,
    }
  })
  return JSON.stringify(rows, null, 2)
}

// ---- internal helpers (exported for tests) ---------------------------------

/**
 * Pad a cell value to a fixed visible width.
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
export function _padCell(text, width) {
  return String(text).padEnd(width)
}

/**
 * Format a cost value as a string.
 * 0 -> "0", 0.12 -> "$0.12", etc.
 * @param {number} cost
 * @returns {string}
 */
export function _formatCost(cost) {
  if (cost === 0) return "0"
  return `$${cost.toFixed(2)}`
}
