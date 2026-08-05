/**
 * isolation — pre-mutation checks and dirty cleanup refusal.
 *
 * Before a voyage starts, the main checkout must be clean (no uncommitted
 * or staged changes). This module provides the checks.
 *
 * @module voyage/isolation
 */

import { spawnSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

// ---- public API ------------------------------------------------------------

/**
 * Check if a git repo is clean (no uncommitted or staged changes).
 *
 * @param {string} repoDir - path to the repo root
 * @returns {{ clean: boolean, dirtyFiles: string[] }}
 */
export function checkGitClean(repoDir) {
  // Check if we're in a git repo
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: repoDir, encoding: "utf8" })
  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    // Not a git repo — nothing to check
    return { clean: true, dirtyFiles: [] }
  }

  // git status --porcelain to find dirty files
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: repoDir, encoding: "utf8" })
  if (status.status !== 0) {
    // git command failed — assume clean to avoid blocking
    return { clean: true, dirtyFiles: [] }
  }

  const lines = status.stdout.trim().split("\n").filter(Boolean)
  if (lines.length === 0) return { clean: true, dirtyFiles: [] }

  // Extract file paths from porcelain output (format: "XY path")
  const dirtyFiles = lines.map((line) => {
    // First two chars are status codes, rest is path
    const path = line.slice(3).trim()
    // Handle renamed files "R  old -> new"
    const arrowIdx = path.indexOf(" -> ")
    return arrowIdx !== -1 ? path.slice(arrowIdx + 4) : path
  })

  return { clean: false, dirtyFiles }
}

/**
 * Check pre-mutation conditions for starting a voyage.
 * Returns { ok: true, reason: null } if clean,
 * or { ok: false, reason: string } if blocked.
 *
 * @param {string} repoDir
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function checkPreMutation(repoDir) {
  const gitState = checkGitClean(repoDir)
  if (!gitState.clean) {
    const files = gitState.dirtyFiles.slice(0, 5)
    const suffix = gitState.dirtyFiles.length > 5 ? ` (and ${gitState.dirtyFiles.length - 5} more)` : ""
    return {
      ok: false,
      reason: `main checkout is dirty: ${files.join(", ")}${suffix}. Commit or stash changes before starting a voyage.`,
    }
  }
  return { ok: true, reason: null }
}

/**
 * Throw if the repo is dirty. Use this as a guard before starting a voyage.
 *
 * @param {string} repoDir
 * @throws {Error} if repo is dirty
 */
export function refuseIfDirty(repoDir) {
  const result = checkPreMutation(repoDir)
  if (!result.ok) {
    throw new Error(result.reason)
  }
}

/**
 * Check if the armada state directory has unshipped / in-progress artifacts.
 * Looks for non-empty features directory, active.json, or history entries.
 *
 * @param {string} repoDir
 * @returns {boolean}
 */
export function hasDirtyState(repoDir) {
  const stateDir = join(repoDir, "armada", "state")
  if (!existsSync(stateDir)) return false

  // Check for active.json
  if (existsSync(join(stateDir, "active.json"))) return true

  // Check for feature entries
  const featuresDir = join(stateDir, "features")
  if (existsSync(featuresDir)) {
    try {
      const entries = readdirSync(featuresDir)
      if (entries.length > 0) return true
    } catch {
      // unreadable — assume dirty
      return true
    }
  }

  // Check for history entries
  const historyDir = join(stateDir, "history")
  if (existsSync(historyDir)) {
    try {
      const entries = readdirSync(historyDir)
      if (entries.length > 0) return true
    } catch {
      return true
    }
  }

  return false
}

/**
 * Refuse to clean up state if there are unshipped artifacts.
 * Throws unless `force` is true.
 *
 * @param {string} repoDir
 * @param {{ force?: boolean }} [opts]
 * @throws {Error} if state is dirty and force is not set
 */
export function refuseDirtyCleanup(repoDir, opts = {}) {
  if (opts.force) return
  if (hasDirtyState(repoDir)) {
    throw new Error("refusing to clean dirty state: unshipped artifacts exist. Use --force to proceed.")
  }
}
