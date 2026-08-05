/**
 * worktree — per-voyage git worktree management.
 *
 * Each voyage gets its own git worktree (branch + directory). This module
 * creates, lists, and removes them with isolation guarantees.
 *
 * @module voyage/worktree
 */

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync } from "node:fs"
import { join } from "node:path"

// ---- public API ------------------------------------------------------------

/**
 * Create a git worktree for a voyage.
 * Creates branch `feat/<name>` and worktree at `sandbox/<name>`.
 *
 * @param {string} repoDir - main repo root
 * @param {string} name - voyage/feature name
 * @returns {string} absolute path to the worktree
 * @throws {Error} if worktree or branch already exists, or git fails
 */
export function createVoyageWorktree(repoDir, name) {
  const branch = `feat/${name}`
  const worktreePath = join(repoDir, "sandbox", name)

  // Ensure sandbox dir exists
  const sandboxDir = join(repoDir, "sandbox")
  if (!existsSync(sandboxDir)) {
    mkdirSync(sandboxDir, { recursive: true })
  }

  const result = spawnSync("git", ["worktree", "add", "-b", branch, worktreePath], {
    cwd: repoDir,
    encoding: "utf8",
  })

  if (result.status !== 0) {
    const stderr = (result.stderr || result.stdout || "").trim()
    if (stderr.includes("already exists") || stderr.includes("already checked out")) {
      throw new Error(`worktree or branch already exists: ${branch}`)
    }
    throw new Error(`git worktree add failed: ${stderr}`)
  }

  return worktreePath
}

/**
 * Remove a voyage worktree and its branch.
 *
 * @param {string} repoDir - main repo root
 * @param {string} worktreePath - absolute path to the worktree
 * @param {string} branch - branch name to delete
 * @throws {Error} if git worktree remove fails
 */
export function removeVoyageWorktree(repoDir, worktreePath, branch) {
  const removeResult = spawnSync("git", ["worktree", "remove", "--force", worktreePath], {
    cwd: repoDir,
    encoding: "utf8",
  })

  if (removeResult.status !== 0) {
    const stderr = (removeResult.stderr || removeResult.stdout || "").trim()
    throw new Error(`git worktree remove failed: ${stderr}`)
  }

  // Delete the branch
  const branchResult = spawnSync("git", ["branch", "-D", branch], {
    cwd: repoDir,
    encoding: "utf8",
  })

  if (branchResult.status !== 0) {
    // Branch may already be gone (merged or manually deleted) — not an error
  }
}

/**
 * List all voyage worktrees for a repo.
 * Parses `git worktree list` output.
 *
 * @param {string} repoDir
 * @returns {Array<{ path: string, branch: string, head: string }>}
 */
export function listVoyageWorktrees(repoDir) {
  const result = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoDir,
    encoding: "utf8",
  })

  if (result.status !== 0) return []

  const lines = result.stdout.trim().split("\n")
  const worktrees = []
  let current = null

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      if (current) worktrees.push(current)
      current = { path: line.slice(9), branch: "", head: "" }
    } else if (line.startsWith("branch ")) {
      if (current) current.branch = line.slice(7).replace(/^refs\/heads\//, "")
    } else if (line.startsWith("HEAD ")) {
      if (current) current.head = line.slice(5)
    }
  }
  if (current) worktrees.push(current)

  return worktrees
}

/**
 * Find orphan worktrees: worktree directories on disk that are not tracked
 * by git's worktree list (manually removed, stale, etc.).
 *
 * @param {string} repoDir
 * @returns {string[]} absolute paths to orphan worktree directories
 */
export function findOrphanWorktrees(repoDir) {
  const sandboxDir = join(repoDir, "sandbox")
  if (!existsSync(sandboxDir)) return []

  let entries
  try {
    entries = readdirSync(sandboxDir, { withFileTypes: true })
  } catch {
    return []
  }

  const activeWorktrees = listVoyageWorktrees(repoDir)
  const activePaths = new Set(activeWorktrees.map((w) => w.path))

  const orphans = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const fullPath = join(sandboxDir, entry.name)
    if (!activePaths.has(fullPath)) {
      orphans.push(fullPath)
    }
  }

  return orphans
}
