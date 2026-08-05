/**
 * lifecycle — voyage state persistence, action tracking, and exactly-once resume.
 *
 * Voyage state is written atomically to the voyage worktree's
 * `armada/state/voyage.json`. Completed actions are tracked to ensure
 * interrupt-resume never duplicates work.
 *
 * @module voyage/lifecycle
 */

import { join } from "node:path"
import { writeAtomic, readSafe } from "../state/atomic.js"
import {
  createVoyageState as createBase,
  recordAction,
  upgradeState,
  validateVoyageState,
} from "../state/versioned.js"

// ---- re-exported for convenience -------------------------------------------

export { createVoyageState } from "../state/versioned.js"

// ---- state path ------------------------------------------------------------

function statePath(voyageDir) {
  return join(voyageDir, "armada", "state", "voyage.json")
}

// ---- state I/O -------------------------------------------------------------

/**
 * Write voyage state atomically to `armada/state/voyage.json` inside the
 * voyage directory.
 *
 * @param {string} voyageDir - voyage worktree root
 * @param {object} state - voyage state object
 * @returns {Promise<void>}
 */
export async function writeState(voyageDir, state) {
  await writeAtomic(statePath(voyageDir), JSON.stringify(state, null, 2) + "\n")
}

/**
 * Read voyage state from disk. Returns the state object with version upgrade
 * applied if needed. Returns null if no state file exists.
 *
 * @param {string} voyageDir
 * @returns {object|null}
 */
export function readState(voyageDir) {
  const raw = readSafe(statePath(voyageDir))
  if (raw === null) return null
  const parsed = JSON.parse(raw)
  return upgradeState(parsed)
}

// ---- action tracking -------------------------------------------------------

/**
 * Record a completed action in the voyage state. Reads current state, adds
 * the action (idempotent), and writes back atomically.
 *
 * @param {string} voyageDir
 * @param {string} actionId
 * @returns {Promise<object>} the updated state
 */
export async function recordCompletedAction(voyageDir, actionId) {
  const state = readState(voyageDir)
  if (!state) throw new Error("no voyage state found")
  const updated = recordAction(state, actionId)
  await writeState(voyageDir, updated)
  return updated
}

// ---- resume -----------------------------------------------------------------

/**
 * Resume a voyage: run all action handlers that have not been completed yet,
 * in order. Each action is recorded immediately after it completes.
 * If a handler throws, the state is marked as "interrupted" and the error
 * is re-thrown. Actions that completed before the failure are preserved.
 *
 * @param {string} voyageDir
 * @param {Record<string, () => Promise<void>>} handlers - actionId -> handler
 * @returns {Promise<void>}
 */
export async function resumeVoyage(voyageDir, handlers) {
  let state = readState(voyageDir)
  if (!state) {
    state = createBase({ voyage: "unknown" })
    await writeState(voyageDir, state)
  }

  const actionIds = Object.keys(handlers)

  for (const actionId of actionIds) {
    // Reload state before each action (may have been updated by previous)
    state = readState(voyageDir)
    if (state.completedActions.includes(actionId)) continue

    try {
      await handlers[actionId]()
      state = await recordCompletedAction(voyageDir, actionId)
    } catch (err) {
      // Mark as interrupted before re-throwing
      state.status = "interrupted"
      await writeState(voyageDir, state)
      throw err
    }
  }

  // All actions completed — mark voyage as completed
  state = readState(voyageDir)
  state.status = "completed"
  await writeState(voyageDir, state)
}
