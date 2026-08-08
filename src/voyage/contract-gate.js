/**
 * contract-gate — approval gate before voyage launch.
 *
 * Checks that the live contract in the main checkout is APPROVED and its
 * hash matches the contract content. Blocks voyage launch otherwise.
 *
 * @module voyage/contract-gate
 */

import { join, basename, resolve, relative } from "node:path"
import { existsSync, readFileSync, lstatSync, realpathSync } from "node:fs"
import { readSafe } from "../state/atomic.js"
import { computeContractHash, isApproved, validateApprovalState } from "../state/contract-approval.js"
import { execFileSync } from "node:child_process"

// ---- paths ----------------------------------------------------------------

function approvalPath(repoDir) {
  return join(repoDir, "armada", "state", "contract-approval.json")
}

function contractPath(repoDir) {
  return join(repoDir, "armada", "REQUIREMENTS.md")
}

// ---- public API -----------------------------------------------------------

/**
 * Check if the live contract at `repoDir` is approved and ready for voyage launch.
 *
 * @param {string} repoDir - main repository root
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function checkContractApproval(repoDir) {
  // 1. Read approval state
  const apPath = approvalPath(repoDir)
  const raw = readSafe(apPath)
  if (raw === null) {
    return {
      ok: false,
      reason: `contract approval not found at ${apPath}. Create it and set status to APPROVED before launching a voyage.`,
    }
  }

  let approval
  try {
    approval = JSON.parse(raw)
  } catch {
    return {
      ok: false,
      reason: `invalid approval state JSON at ${apPath}. Recreate it.`,
    }
  }

  try {
    validateApprovalState(approval)
  } catch (err) {
    return { ok: false, reason: `approval state validation failed: ${err.message}` }
  }

  // 2. Check contract file exists and is not a symlink
  const cPath = contractPath(repoDir)
  if (!existsSync(cPath)) {
    return {
      ok: false,
      reason: `live contract not found at ${cPath}. Create it and approve before launching a voyage.`,
    }
  }

  // Reject symlinked contracts (DEF-008) — prevents arbitrary file ingestion
  try {
    const lstat = lstatSync(cPath)
    if (lstat.isSymbolicLink()) {
      return {
        ok: false,
        reason: `live contract at ${cPath} is a symlink. Contracts must be regular files. Replace the symlink with the actual contract.`,
      }
    }
  } catch (err) {
    return { ok: false, reason: `cannot stat contract at ${cPath}: ${err.message}` }
  }

  // Verify contract stays within repoDir (resolve symlinks for realpath check)
  try {
    const realContract = realpathSync(cPath)
    const realRepo = realpathSync(repoDir)
    if (!realContract.startsWith(realRepo + "/")) {
      return {
        ok: false,
        reason: `contract realpath ${realContract} escapes repo root ${realRepo}`,
      }
    }
  } catch (err) {
    return { ok: false, reason: `cannot resolve contract path: ${err.message}` }
  }

  // 3. Verify hash matches
  if (approval.status === "APPROVED") {
    const content = readFileSync(cPath)
    const currentHash = computeContractHash(content)
    if (currentHash !== approval.contractHash) {
      return {
        ok: false,
        reason: `contract content has changed since approval. Hash mismatch — re-approve the contract before launching a voyage.`,
      }
    }
  }

  // 4. Status check
  if (!isApproved(approval)) {
    return {
      ok: false,
      reason: `contract is not approved (status: ${approval.status}). Set status to APPROVED and ensure hash matches before launching a voyage.`,
    }
  }

  return { ok: true, reason: null }
}

/**
 * Resolve the main checkout directory from a lane path.
 * Uses git worktree metadata to find the main repo root, not string heuristics.
 * Asserts that the sandbox is under the main repo (containment).
 *
 * @param {string} lanePath - absolute path to the lane worktree
 * @param {string} [sandboxDir] - optional sandbox directory to assert containment
 * @returns {string} absolute path to the main checkout
 * @throws {Error} if sandbox is not contained within the main repo
 */
export function resolveMainCheckout(lanePath, sandboxDir) {
  let mainDir
  try {
    // git rev-parse --git-common-dir returns the .git directory path of the
    // main repository (not the worktree). For worktrees, this points to the
    // common .git dir which is the main repo's .git.
    const gitCommonDir = execFileSync("git", ["rev-parse", "--git-common-dir"],
      { cwd: lanePath, encoding: "utf8" }).trim()
    // The main repo is the parent of .git
    mainDir = join(lanePath, gitCommonDir)
    // If it's a relative path from the worktree, resolve it
    mainDir = resolve(lanePath, gitCommonDir)
    // .git lives inside the main repo, so mainDir is the parent of .git
    if (basename(mainDir) === ".git") {
      mainDir = resolve(mainDir, "..")
    }
  } catch {
    // Fall back to string heuristic (backward compat)
    const sep = lanePath.includes("\\") ? "\\" : "/"
    const parts = lanePath.split(sep)
    const sandboxIdx = parts.lastIndexOf("sandbox")
    if (sandboxIdx > 0) {
      mainDir = parts.slice(0, sandboxIdx).join(sep)
    } else {
      mainDir = lanePath
    }
  }

  // Containment check: sandbox must be under the main repo
  if (sandboxDir !== undefined) {
    const realMain = realpathSync(mainDir)
    const realSandbox = realpathSync(sandboxDir)
    const rel = relative(realMain, realSandbox)
    if (rel.startsWith("..") || resolve(realMain, rel) !== realSandbox) {
      throw new Error(
        `sandbox ${sandboxDir} is not under the main repo ${mainDir}. ` +
        `Launch from a lane contained within the main checkout.`
      )
    }
  }

  return mainDir
}

/**
 * Check if an approval state file exists in the repo (opt-in gating).
 * Returns true if `armada/state/contract-approval.json` exists.
 *
 * @param {string} repoDir
 * @returns {boolean}
 */
export function isApprovalStatePresent(repoDir) {
  return existsSync(approvalPath(repoDir))
}

/**
 * Throw if the live contract is not approved and ready for voyage launch.
 *
 * @param {string} repoDir
 * @throws {Error}
 */
export function refuseIfNotApproved(repoDir) {
  const result = checkContractApproval(repoDir)
  if (!result.ok) throw new Error(result.reason)
}
