/**
 * contract-snapshot — byte-for-byte propagation of approved contract into sandbox.
 *
 * When a voyage is launched from an approved live contract, this module copies
 * the contract and approval metadata into the sandbox and verifies byte identity.
 *
 * @module voyage/contract-snapshot
 */

import { join, dirname } from "node:path"
import { existsSync, readFileSync, copyFileSync, mkdirSync, rmSync } from "node:fs"
import { writeAtomic, readSafe } from "../state/atomic.js"
import {
  computeContractHash,
  validateApprovalState,
  createApprovalState,
  approveContract,
} from "../state/contract-approval.js"
import { checkContractApproval } from "./contract-gate.js"

// ---- helpers ---------------------------------------------------------------

function nowISO() { return new Date().toISOString() }

function approvalPath(repoDir) {
  return join(repoDir, "armada", "state", "contract-approval.json")
}

function contractPath(repoDir) {
  return join(repoDir, "armada", "REQUIREMENTS.md")
}

// ---- public API ------------------------------------------------------------

/**
 * Connect an explicitly approved contract to the existing approval gate.
 * Contracts without a Status line retain legacy opt-in behavior.
 *
 * @param {string} repoDir - main repository root
 * @returns {Promise<{ required: boolean, ok: boolean, reason?: string }>}
 */
export async function ensureApprovalState(repoDir) {
  const path = contractPath(repoDir)
  if (!existsSync(path)) {
    return { required: false, ok: true }
  }

  const content = readFileSync(path, "utf8")
  const status = content.match(/^Status:\s*(\S+)\s*$/mi)?.[1]?.toUpperCase()
  if (!status) return { required: false, ok: true }
  if (status !== "APPROVED") {
    return { required: true, ok: false, reason: `contract is not approved (status: ${status})` }
  }

  const existing = readSafe(approvalPath(repoDir))
  if (existing !== null) {
    const gate = checkContractApproval(repoDir)
    return { required: true, ok: gate.ok, ...(gate.ok ? {} : { reason: gate.reason }) }
  }

  const state = approveContract(
    createApprovalState({ contractPath: path }),
    "user",
    content,
  )
  await writeAtomic(approvalPath(repoDir), JSON.stringify(state, null, 2) + "\n", { mode: 0o600 })
  return { required: true, ok: true }
}

/**
 * Copy the approved live contract and approval metadata into the sandbox.
 * Verifies byte-for-byte identity after copy.
 *
 * @param {string} repoDir - main repository root
 * @param {string} sandboxDir - sandbox worktree root
 * @returns {Promise<{ ok: boolean, reason: string|null, hash: string|null }>}
 */
export async function snapshotContract(repoDir, sandboxDir) {
  // 1. Gate: refuse if not approved
  const gate = checkContractApproval(repoDir)
  if (!gate.ok) {
    return { ok: false, reason: gate.reason, hash: null }
  }

  // 2. Read live approval state
  const rawApproval = readSafe(approvalPath(repoDir))
  if (rawApproval === null) {
    return { ok: false, reason: "approval state missing", hash: null }
  }
  let approval
  try {
    approval = JSON.parse(rawApproval)
  } catch {
    return { ok: false, reason: "invalid approval state JSON — may have been corrupted after gate check", hash: null }
  }
  validateApprovalState(approval)

  // 3. Read live contract
  const liveContent = readFileSync(contractPath(repoDir))
  const liveHash = computeContractHash(liveContent)

  // 4. Ensure sandbox directories exist
  const sandboxArmadaDir = join(sandboxDir, "armada")
  if (!existsSync(sandboxArmadaDir)) {
    mkdirSync(sandboxArmadaDir, { recursive: true })
  }
  const sandboxStateDir = join(sandboxArmadaDir, "state")
  if (!existsSync(sandboxStateDir)) {
    mkdirSync(sandboxStateDir, { recursive: true })
  }

  // 5. Copy contract byte-for-byte
  const sandboxContractPath = join(sandboxArmadaDir, "REQUIREMENTS.md")
  copyFileSync(contractPath(repoDir), sandboxContractPath)

  // 6. Verify byte-for-byte
  const sandboxContent = readFileSync(sandboxContractPath)
  if (Buffer.compare(liveContent, sandboxContent) !== 0) {
    return { ok: false, reason: "snapshot verification failed: byte mismatch after copy", hash: null }
  }

  // 6b. Re-verify post-copy hash against approval.contractHash (DEF-003)
  // Guards against TOCTOU race: contract changed between gate check and copyFileSync.
  const sandboxHash = computeContractHash(sandboxContent)
  if (sandboxHash !== approval.contractHash) {
    // Attempt cleanup: delete the unauthorized sandbox copy
    try { rmSync(sandboxContractPath) } catch { /* best effort */ }
    return {
      ok: false,
      reason: "post-copy hash mismatch: sandbox contract hash does not match approved hash. The contract may have been modified during snapshot.",
      hash: null,
    }
  }

  // 7. Update approval metadata with sync info
  const sandboxApproval = structuredClone(approval)
  sandboxApproval.lastSyncedAt = nowISO()
  sandboxApproval.lastSyncedTo = [...(sandboxApproval.lastSyncedTo || []), sandboxDir]
  // Deduplicate
  sandboxApproval.lastSyncedTo = [...new Set(sandboxApproval.lastSyncedTo)]

  // Write approval metadata into sandbox
  await writeAtomic(
    join(sandboxStateDir, "contract-approval.json"),
    JSON.stringify(sandboxApproval, null, 2) + "\n",
    { mode: 0o600 }
  )

  return { ok: true, reason: null, hash: liveHash }
}

/**
 * Verify that two contract files are byte-for-byte identical.
 * Returns { ok: boolean, reason: string|null }.
 *
 * @param {string} livePath - path to live contract
 * @param {string} sandboxPath - path to sandbox contract
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function verifySnapshot(livePath, sandboxPath) {
  if (!existsSync(livePath)) {
    return { ok: false, reason: `live contract not found: ${livePath}` }
  }
  if (!existsSync(sandboxPath)) {
    return { ok: false, reason: `sandbox contract not found: ${sandboxPath}` }
  }
  const live = readFileSync(livePath)
  const sandbox = readFileSync(sandboxPath)
  if (Buffer.compare(live, sandbox) !== 0) {
    return { ok: false, reason: "byte mismatch: sandbox contract differs from live contract" }
  }
  return { ok: true, reason: null }
}
