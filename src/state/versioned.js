/**
 * versioned — versioned voyage state schema.
 *
 * Every state object carries a `version` field. Readers can handle older
 * versions via `upgradeState`. Writers always produce the current version.
 *
 * @module state/versioned
 */

// ---- constants -------------------------------------------------------------

export const STATE_VERSION = 1

// ---- helpers ---------------------------------------------------------------

function nowISO() { return new Date().toISOString() }

function checkNonEmptyString(val, path) {
  if (typeof val !== "string" || val === "") throw new Error(`${path}: must be a non-empty string`)
}

function checkObject(val, path) {
  if (val === null || typeof val !== "object" || Array.isArray(val)) throw new Error(`${path}: must be a plain object`)
}

function checkArray(val, path) {
  if (!Array.isArray(val)) throw new Error(`${path}: must be an array`)
}

// ---- public API ------------------------------------------------------------

/**
 * Create a fresh voyage state object at the current version.
 *
 * @param {object} params
 * @param {string} params.voyage - voyage name
 * @param {string} [params.branch] - git branch name
 * @param {string} [params.worktree] - worktree path
 * @param {string} [params.contract] - contract path
 * @returns {VoyageState}
 */
export function createVoyageState({ voyage, branch, worktree, contract, status, inFlightAction }) {
  const now = nowISO()
  return {
    version: STATE_VERSION,
    voyage,
    branch: branch || "",
    worktree: worktree || "",
    contract: contract || "armada/REQUIREMENTS.md",
    status: status || "active",
    completedActions: [],
    inFlightAction: inFlightAction || null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Record a completed action. Returns a new state — original is not mutated.
 * Actions are idempotent: recording the same actionId twice has no effect.
 *
 * @param {VoyageState} state
 * @param {string} actionId
 * @returns {VoyageState}
 */
export function recordAction(state, actionId) {
  // Already recorded? Return unchanged.
  if (state.completedActions.includes(actionId)) return state
  const next = structuredClone(state)
  next.completedActions.push(actionId)
  next.updatedAt = nowISO()
  // If this was the inFlightAction, clear it
  if (next.inFlightAction === actionId) {
    next.inFlightAction = null
  }
  return next
}

/**
 * Mark a voyage state as completed. Returns a new state — original is not mutated.
 *
 * @param {VoyageState} state
 * @returns {VoyageState}
 */
export function markCompleted(state) {
  const next = structuredClone(state)
  next.status = "completed"
  next.inFlightAction = null
  next.updatedAt = nowISO()
  return next
}

/**
 * Upgrade a state object from an older version to the current version.
 * Returns a new object. If already at current version, returns unchanged.
 *
 * @param {object} state
 * @returns {VoyageState}
 */
export function upgradeState(state) {
  const version = state.version || 0

  if (version >= STATE_VERSION) return state

  let upgraded = structuredClone(state)

  // v0 -> v1: add version field and missing fields
  if (version < 1) {
    upgraded.version = STATE_VERSION
    if (!upgraded.createdAt) upgraded.createdAt = upgraded.updatedAt || nowISO()
    if (!upgraded.updatedAt) upgraded.updatedAt = upgraded.createdAt
    if (!upgraded.branch) upgraded.branch = ""
    if (!upgraded.worktree) upgraded.worktree = ""
    if (!upgraded.contract) upgraded.contract = "armada/REQUIREMENTS.md"
    if (!upgraded.status) upgraded.status = "active"
    if (!upgraded.completedActions) upgraded.completedActions = []
    if (upgraded.inFlightAction === undefined) upgraded.inFlightAction = null
  }

  return upgraded
}

/**
 * Validate a voyage state object. Throws if invalid, returns the state if valid.
 *
 * @param {unknown} obj
 * @returns {VoyageState}
 */
export function validateVoyageState(obj) {
  checkObject(obj, "voyageState")
  checkNonEmptyString(obj.voyage, "voyageState.voyage")
  if (typeof obj.version !== "number" || !Number.isInteger(obj.version) || obj.version < 1) {
    throw new Error("voyageState.version: must be a positive integer")
  }
  checkNonEmptyString(obj.status, "voyageState.status")
  if (!["active", "completed", "interrupted", "orphaned", "in_progress", "paused", "aborted"].includes(obj.status)) {
    throw new Error("voyageState.status: must be one of active|completed|interrupted|orphaned|in_progress|paused|aborted")
  }
  checkArray(obj.completedActions, "voyageState.completedActions")
  return obj
}
