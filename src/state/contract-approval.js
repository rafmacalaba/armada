/**
 * contract-approval — contract approval state schema.
 *
 * Manages the lifecycle of contract approval: PENDING -> APPROVED -> STALE.
 * The main checkout owns the live approval; sandboxes receive snapshots.
 *
 * @module state/contract-approval
 */

import { createHash } from "node:crypto"

// ---- constants -----------------------------------------------------------

/** Valid approval statuses. */
export const APPROVAL_STATUSES = ["APPROVED", "PENDING", "STALE", "NEEDS_REVIEW"]

/** Paths that non-orchestrator roles must never have write access to. */
export const RESTRICTED_PATHS = [
  "armada/REQUIREMENTS.md",
  "armada/state/",
  "armada/ledgers/",
  ".opencode/agent/",
]

/** Paths visible to workers but only for reading. */
export const WORKER_READONLY_PATHS = [
  "armada/REQUIREMENTS.md",
  "armada/state/contract-approval.json",
]

// ---- helpers --------------------------------------------------------------

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

// ---- hash ----------------------------------------------------------------

/**
 * Compute SHA-256 hash of contract content. Deterministic.
 * Accepts Buffer or string. Buffers are hashed as-is; strings are hashed
 * as UTF-8 bytes.
 * @param {Buffer|string} content
 * @returns {string} hex digest
 */
export function computeContractHash(content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8")
  return createHash("sha256").update(buf).digest("hex")
}

// ---- state creation ------------------------------------------------------

/**
 * Create a fresh approval state. Starts as PENDING.
 *
 * @param {object} params
 * @param {string} params.contractPath - absolute path to live contract
 * @returns {ContractApprovalState}
 */
export function createApprovalState({ contractPath }) {
  return {
    status: "PENDING",
    approvedAt: null,
    approver: null,
    contractHash: null,
    liveContractPath: contractPath,
    lastSyncedAt: null,
    lastSyncedTo: [],
    clarificationRequested: false,
    clarificationReason: null,
  }
}

// ---- state transitions ---------------------------------------------------

/**
 * Approve the contract. Transitions status to APPROVED and records approval
 * metadata. Contract hash is computed from the provided content.
 *
 * @param {ContractApprovalState} state
 * @param {string} approver - who approved
 * @param {string} contractContent - full content of REQUIREMENTS.md at approval time
 * @returns {ContractApprovalState} new state (original is not mutated)
 */
export function approveContract(state, approver, contractContent) {
  const next = structuredClone(state)
  next.status = "APPROVED"
  next.approver = approver
  next.approvedAt = nowISO()
  next.contractHash = computeContractHash(contractContent)
  next.hashAlgo = "sha256"
  next.schemaVersion = 1
  return next
}

/**
 * Invalidate approval. Transitions APPROVED to STALE. Clears contractHash.
 * Used when contract content changes or clarification is needed.
 *
 * @param {ContractApprovalState} state
 * @returns {ContractApprovalState} new state (original is not mutated)
 */
export function invalidateApproval(state) {
  const next = structuredClone(state)
  next.status = "STALE"
  next.contractHash = null
  return next
}

// ---- queries -------------------------------------------------------------

/**
 * Check if approval state is currently APPROVED.
 * @param {ContractApprovalState} state
 * @returns {boolean}
 */
export function isApproved(state) {
  return state.status === "APPROVED" && state.contractHash !== null
}

// ---- validation ----------------------------------------------------------

/**
 * Validate an approval state object. Throws if invalid.
 * @param {unknown} obj
 * @returns {ContractApprovalState}
 */
export function validateApprovalState(obj) {
  checkObject(obj, "approvalState")
  checkNonEmptyString(obj.status, "approvalState.status")
  if (!APPROVAL_STATUSES.includes(obj.status)) {
    throw new Error(`approvalState.status: must be one of ${APPROVAL_STATUSES.join("|")}`)
  }
  if (obj.status === "APPROVED") {
    checkNonEmptyString(obj.approver, "approvalState.approver")
    checkNonEmptyString(obj.approvedAt, "approvalState.approvedAt")
    checkNonEmptyString(obj.contractHash, "approvalState.contractHash")
    if (!/^[0-9a-f]{64}$/.test(obj.contractHash)) {
      throw new Error("approvalState.contractHash: must be a valid SHA-256 hex digest (64 hex chars)")
    }
  }
  if (obj.hashAlgo !== undefined && obj.hashAlgo !== "sha256") {
    throw new Error(`approvalState.hashAlgo: unsupported algorithm "${obj.hashAlgo}" (only "sha256" is supported)`)
  }
  if (obj.schemaVersion !== undefined && obj.schemaVersion !== 1) {
    throw new Error(`approvalState.schemaVersion: unsupported version ${obj.schemaVersion} (only version 1 is supported)`)
  }
  checkNonEmptyString(obj.liveContractPath, "approvalState.liveContractPath")
  checkArray(obj.lastSyncedTo, "approvalState.lastSyncedTo")
  return obj
}
