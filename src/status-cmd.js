/**
 * status-cmd — renders feature status from armada/state files.
 *
 * Reads armada/state/active.json + armada/state/features/index.json.
 * Table by default. --json for machine output. Exit 1 if neither file exists.
 *
 * @module status-cmd
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

// ---- public API ------------------------------------------------------------

/**
 * Render a status table from state files.
 * @param {string} stateDir - path to armada/state directory
 * @param {{ json?: boolean }} [opts]
 * @returns {{ code: number, output: string }}
 */
export function renderStatus(stateDir, opts = {}) {
  const activePath = resolve(stateDir, "active.json")
  const indexPath = resolve(stateDir, "features", "index.json")

  const activeExists = existsSync(activePath)
  const indexExists = existsSync(indexPath)

  if (!activeExists && !indexExists) {
    return { code: 1, output: "no active feature or feature index\n" }
  }

  let active = null
  if (activeExists) {
    active = JSON.parse(readFileSync(activePath, "utf8"))
  }

  let features = []
  if (indexExists) {
    const raw = JSON.parse(readFileSync(indexPath, "utf8"))
    features = Array.isArray(raw) ? raw : []
  }

  // Merge: features from index, enriched with active.json data
  const rows = features.map((f) => {
    const isActive = active && active.feature === f.name
    return {
      feature: f.name,
      status: f.status,
      contract: f.contract,
      nextAction: isActive ? (active.nextAction || null) : null,
      pr: isActive ? (active.prUrl || null) : null,
    }
  })

  // If active.json exists but feature is not in index, add it
  if (active && !features.find((f) => f.name === active.feature)) {
    rows.push({
      feature: active.feature,
      status: "in_progress",
      contract: active.contract,
      nextAction: active.nextAction || null,
      pr: active.prUrl || null,
    })
  }

  if (rows.length === 0) {
    return { code: 0, output: "no features registered\n" }
  }

  if (opts.json) {
    return { code: 0, output: JSON.stringify(rows, null, 2) + "\n" }
  }

  return { code: 0, output: _renderTable(rows) }
}

/**
 * CLI main entry point.
 * @param {string[]} argv - remaining args after "status"
 * @param {{ stateDir?: string }} [opts]
 * @returns {{ code: number, output: string }}
 */
export function main(argv = [], opts = {}) {
  const stateDir = opts.stateDir || resolve(opts.cwd || ".", "armada", "state")
  const json = argv.includes("--json")
  return renderStatus(stateDir, { json })
}

// ---- internal helpers (exported for tests) ---------------------------------

/**
 * Render an aligned table from row objects.
 * @param {{ feature: string, status: string, contract: string, nextAction: string, pr: string }[]} rows
 * @returns {string}
 */
export function _renderTable(rows) {
  const header = ["FEATURE", "STATUS", "CONTRACT", "NEXT ACTION", "PR"]

  const displayRows = rows.map((r) => ({
    feature: r.feature,
    status: r.status,
    contract: r.contract,
    nextAction: r.nextAction ?? "-",
    pr: r.pr ?? "-",
  }))

  const widths = {
    feature: Math.max(header[0].length, ...displayRows.map((r) => r.feature.length)),
    status: Math.max(header[1].length, ...displayRows.map((r) => r.status.length)),
    contract: Math.max(header[2].length, ...displayRows.map((r) => r.contract.length)),
    nextAction: Math.max(header[3].length, ...displayRows.map((r) => r.nextAction.length)),
    pr: Math.max(header[4].length, ...displayRows.map((r) => r.pr.length)),
  }

  const headerRow = [
    _padCell(header[0], widths.feature),
    _padCell(header[1], widths.status),
    _padCell(header[2], widths.contract),
    _padCell(header[3], widths.nextAction),
    _padCell(header[4], widths.pr),
  ].join("  ")

  const separator = [
    "-".repeat(widths.feature),
    "-".repeat(widths.status),
    "-".repeat(widths.contract),
    "-".repeat(widths.nextAction),
    "-".repeat(widths.pr),
  ].join("  ")

  const dataRows = displayRows.map((r) =>
    [
      _padCell(r.feature, widths.feature),
      _padCell(r.status, widths.status),
      _padCell(r.contract, widths.contract),
      _padCell(r.nextAction, widths.nextAction),
      _padCell(r.pr, widths.pr),
    ].join("  ")
  )

  return [headerRow, separator, ...dataRows].join("\n") + "\n"
}

/**
 * Pad a cell value to a fixed visible width.
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
export function _padCell(text, width) {
  return String(text).padEnd(width)
}
