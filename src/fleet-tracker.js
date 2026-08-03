/**
 * Fleet tracker — per-lane run store for the armada dashboard.
 *
 * Pure schema + staleness logic + I/O wrapper under ~/.armada/runs/.
 * Respects ARMADA_RUNS_DIR env for test isolation.
 *
 * @module fleet-tracker
 */

import { mkdirSync } from "node:fs"
import { writeFile, rename, readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { homedir } from "node:os"
import { randomUUID } from "node:crypto"

// ---- helpers --------------------------------------------------------------

const VALID_PHASE_STATUSES = new Set(["pending", "in_progress", "passed"])
const VALID_RUN_STATUSES = new Set(["ACTIVE", "STALLED"])

function checkNonEmptyString(val, path) {
  if (typeof val !== "string" || val === "") throw new Error(`${path}: must be a non-empty string`)
}

function checkString(val, path) {
  if (typeof val !== "string") throw new Error(`${path}: must be a string`)
}

function checkNumber(val, path) {
  if (typeof val !== "number" || Number.isNaN(val)) throw new Error(`${path}: must be a number`)
}

function checkArray(val, path) {
  if (!Array.isArray(val)) throw new Error(`${path}: must be an array`)
}

function checkObject(val, path) {
  if (val === null || typeof val !== "object" || Array.isArray(val)) throw new Error(`${path}: must be a plain object`)
}

// ---- pure API -------------------------------------------------------------

/**
 * @typedef {{ session: string, cwd: string, branch: string, contractPath: string, tmuxPaneTail?: string }} DefaultRunEntryParams
 */

/**
 * Create a fresh run entry with sensible defaults.
 * @param {DefaultRunEntryParams} params
 * @returns {object}
 */
export function defaultRunEntry({ session, cwd, branch, contractPath, tmuxPaneTail = "" }) {
  checkNonEmptyString(session, "session")
  checkNonEmptyString(cwd, "cwd")
  checkNonEmptyString(branch, "branch")
  checkNonEmptyString(contractPath, "contractPath")
  checkString(tmuxPaneTail, "tmuxPaneTail")

  const now = new Date().toISOString()
  return {
    session,
    lane: cwd,
    branch,
    contract: contractPath,
    startedAt: now,
    lastHeartbeatAt: now,
    lastNextAction: "",
    lastEvidence: [],
    phaseStatuses: {},
    tmuxPaneTail,
    cost: 0,
    status: "ACTIVE",
  }
}

/**
 * Validate a run entry. Returns entry on success, throws on failure.
 * @param {unknown} entry
 * @returns {object}
 */
export function validateRunEntry(entry) {
  checkObject(entry, "entry")

  checkNonEmptyString(entry.session, "entry.session")
  checkNonEmptyString(entry.lane, "entry.lane")
  checkNonEmptyString(entry.branch, "entry.branch")
  checkNonEmptyString(entry.contract, "entry.contract")
  checkNonEmptyString(entry.startedAt, "entry.startedAt")
  checkNonEmptyString(entry.lastHeartbeatAt, "entry.lastHeartbeatAt")
  checkString(entry.tmuxPaneTail, "entry.tmuxPaneTail")

  checkString(entry.lastNextAction, "entry.lastNextAction")
  checkArray(entry.lastEvidence, "entry.lastEvidence")

  checkObject(entry.phaseStatuses, "entry.phaseStatuses")
  for (const [key, val] of Object.entries(entry.phaseStatuses)) {
    if (!VALID_PHASE_STATUSES.has(val)) {
      throw new Error(`entry.phaseStatuses["${key}"]: must be one of pending|in_progress|passed`)
    }
  }

  checkNumber(entry.cost, "entry.cost")
  checkString(entry.status, "entry.status")
  if (!VALID_RUN_STATUSES.has(entry.status)) {
    throw new Error(`entry.status: must be one of ACTIVE|STALLED`)
  }

  return entry
}

/**
 * Compute whether a run is ACTIVE or STALLED based on heartbeat age.
 * @param {object} entry
 * @param {{ now?: number, staleMs?: number }} [opts]
 * @returns {"ACTIVE"|"STALLED"}
 */
export function computeStaleness(entry, { now = Date.now(), staleMs = 2 * 60 * 1000 } = {}) {
  const last = new Date(entry.lastHeartbeatAt).getTime()
  if (now - last > staleMs) return "STALLED"
  return "ACTIVE"
}

/**
 * Compute age of a run in milliseconds.
 * @param {object} entry
 * @param {{ now?: number }} [opts]
 * @returns {number}
 */
export function computeAgeMs(entry, { now = Date.now() } = {}) {
  return Math.max(0, now - new Date(entry.startedAt).getTime())
}

/**
 * Compute human-friendly elapsed time string.
 * @param {object} entry
 * @param {{ now?: number }} [opts]
 * @returns {string}
 */
export function computeElapsed(entry, { now = Date.now() } = {}) {
  const ms = computeAgeMs(entry, { now })
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/**
 * Produce a summary row for the dashboard table.
 * @param {object} entry
 * @returns {{ session: string, lane: string, branch: string, phase: string, status: string, age: string, cost: number }}
 */
export function summarizeRun(entry) {
  let phase = "-"

  // first in_progress phase
  for (const [id, status] of Object.entries(entry.phaseStatuses)) {
    if (status === "in_progress") {
      phase = id
      break
    }
  }

  // fallback: last passed phase
  if (phase === "-") {
    for (const [id, status] of Object.entries(entry.phaseStatuses)) {
      if (status === "passed") phase = id
    }
  }

  return {
    session: entry.session,
    lane: entry.lane,
    branch: entry.branch,
    phase,
    status: entry.status,
    age: computeElapsed(entry),
    cost: entry.cost,
  }
}

// ---- store helpers (I/O) --------------------------------------------------

/**
 * Resolve the store directory, creating it if missing.
 * Respects ARMADA_RUNS_DIR env var.
 * @returns {string}
 */
export function getStoreDir() {
  const dir = process.env.ARMADA_RUNS_DIR || resolve(homedir(), ".armada", "runs")
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Write a run entry atomically: write to .tmp then rename.
 * @param {object} entry
 * @param {{ storeDir?: string }} [opts]
 * @returns {Promise<string>} absolute path written
 */
export async function writeRun(entry, { storeDir = getStoreDir() } = {}) {
  const id = randomUUID()
  const tmpPath = resolve(storeDir, `${entry.session}.${id}.json.tmp`)
  const finalPath = resolve(storeDir, `${entry.session}.json`)
  await writeFile(tmpPath, JSON.stringify(entry, null, 2), "utf8")
  await rename(tmpPath, finalPath)
  return finalPath
}

/**
 * Read a single run entry by session name.
 * @param {string} session
 * @param {{ storeDir?: string }} [opts]
 * @returns {Promise<object|null>}
 */
export async function readRun(session, { storeDir = getStoreDir() } = {}) {
  const filePath = resolve(storeDir, `${session}.json`)
  try {
    const raw = await readFile(filePath, "utf8")
    const entry = JSON.parse(raw)
    return validateRunEntry(entry)
  } catch (e) {
    if (e.code === "ENOENT") return null
    throw e
  }
}

/**
 * List all runs, sorted by startedAt descending.
 * @param {{ storeDir?: string }} [opts]
 * @returns {Promise<object[]>}
 */
export async function listRuns({ storeDir = getStoreDir() } = {}) {
  let entries
  try {
    entries = await readdir(storeDir)
  } catch (e) {
    if (e.code === "ENOENT") return []
    throw e
  }

  const runs = []
  for (const file of entries) {
    if (!file.endsWith(".json")) continue
    const raw = await readFile(resolve(storeDir, file), "utf8")
    const entry = JSON.parse(raw)
    validateRunEntry(entry)
    runs.push(entry)
  }

  runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  return runs
}

/**
 * Read, patch, and write a run entry atomically.
 * @param {string} session
 * @param {object} patch
 * @param {{ storeDir?: string }} [opts]
 * @returns {Promise<object>} merged entry
 */
export async function updateRun(session, patch, opts = {}) {
  const entry = await readRun(session, opts)
  if (!entry) throw new Error(`updateRun: session "${session}" not found`)
  const merged = { ...entry, ...patch }
  await writeRun(merged, opts)
  return merged
}
