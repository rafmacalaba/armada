/**
 * fleet-discover — scan sandbox/ for untracked voyage worktrees.
 *
 * Pure functions for listing, rendering, and registering orphans.
 *
 * @module fleet-discover
 */

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { isAbsolute, join, resolve } from "node:path"
import { defaultRunEntry, getStoreDir, writeRun } from "./fleet-tracker.js"

/**
 * @typedef {{ session: string, lane: string, branch: string, contract: string, worktreePath: string }} Orphan
 */

/**
 * List orphan worktrees in a repo's sandbox/ directory.
 * @param {{ repoDir: string, runsDir: string }} opts
 * @returns {Orphan[]}
 */
export function listOrphans({ repoDir, runsDir }) {
  const sandboxDir = join(repoDir, "sandbox")
  if (!existsSync(sandboxDir)) return []

  const entries = readdirSync(sandboxDir, { withFileTypes: true })
  const orphans = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const worktreePath = join(sandboxDir, entry.name)
    const gitFile = join(worktreePath, ".git")
    const contractPath = join(worktreePath, "armada", "REQUIREMENTS.md")

    // Skip if no .git file (not a worktree)
    if (!existsSync(gitFile)) continue

    // Skip if no armada/REQUIREMENTS.md (not a voyage)
    if (!existsSync(contractPath)) continue

    // Skip if already registered (run JSON exists)
    const runFile = join(runsDir, `${entry.name}.json`)
    if (existsSync(runFile)) continue

    const session = entry.name
    const lane = worktreePath

    // Resolve branch from .git file
    let branch = `feat/${session}` // fallback
    try {
      const gitContent = readFileSync(gitFile, "utf8").trim()
      if (gitContent.startsWith("gitdir: ")) {
        let gitdirPath = gitContent.slice("gitdir: ".length).trim()
        if (!isAbsolute(gitdirPath)) {
          gitdirPath = resolve(worktreePath, gitdirPath)
        }
        const headPath = join(gitdirPath, "HEAD")
        if (existsSync(headPath)) {
          const headContent = readFileSync(headPath, "utf8").trim()
          const prefix = "ref: refs/heads/"
          if (headContent.startsWith(prefix)) {
            branch = headContent.slice(prefix.length)
          }
        }
      }
    } catch {
      // fallback
    }

    const contract = contractPath

    orphans.push({ session, lane, branch, contract, worktreePath })
  }

  orphans.sort((a, b) => a.session.localeCompare(b.session))
  return orphans
}

/**
 * Render a table of orphan worktrees.
 * @param {Orphan[]} orphans
 * @returns {string}
 */
export function renderDiscoverTable(orphans) {
  if (orphans.length === 0) return "no orphan worktrees"

  const headers = ["SESSION", "LANE", "BRANCH", "CONTRACT", "STATUS"]
  const rows = orphans.map((o) => [o.session, o.lane, o.branch, o.contract, "untracked"])

  const widths = headers.map((h, i) => {
    const dataMax = Math.max(...rows.map((r) => String(r[i]).length))
    return Math.max(h.length, dataMax)
  })

  const pad = (text, width) => String(text).padEnd(width)

  const headerRow = headers.map((h, i) => pad(h, widths[i])).join("  ")
  const separator = widths.map((w) => "-".repeat(w)).join("  ")
  const dataRows = rows.map((row) => row.map((cell, i) => pad(cell, widths[i])).join("  "))

  return [headerRow, separator, ...dataRows].join("\n")
}

/**
 * Render orphan list as JSON.
 * @param {Orphan[]} orphans
 * @returns {string}
 */
export function renderDiscoverJson(orphans) {
  return JSON.stringify(orphans.map((o) => ({
    session: o.session,
    lane: o.lane,
    branch: o.branch,
    contract: o.contract,
    worktreePath: o.worktreePath,
  })), null, 2)
}

/**
 * Register orphans by writing run JSON entries.
 * @param {Orphan[]} orphans
 * @param {{ storeDir?: string }} [opts]
 * @returns {Promise<Array<{ session: string, status: string, path?: string }>>}
 */
export async function registerOrphans(orphans, { storeDir = getStoreDir() } = {}) {
  const results = []

  for (const orphan of orphans) {
    const runPath = join(storeDir, `${orphan.session}.json`)
    if (existsSync(runPath)) {
      results.push({ session: orphan.session, status: "skipped" })
      continue
    }

    const entry = defaultRunEntry({
      session: orphan.session,
      cwd: orphan.lane,
      branch: orphan.branch,
      contractPath: orphan.contract,
    })

    // Patch the lastNextAction
    entry.lastNextAction = "registered via fleet discover — no live session"

    const writtenPath = await writeRun(entry, { storeDir })
    results.push({ session: orphan.session, status: "registered", path: writtenPath })
  }

  return results
}
