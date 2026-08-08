/**
 * armada feature-commands — file-I/O wrappers around src/state.js.
 *
 * @module feature-commands
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync, realpathSync } from "node:fs"
import { join, basename } from "node:path"
import { spawnSync } from "node:child_process"
import {
  emptyActive,
  emptyFeatureIndexEntry,
  validateFeatureIndexEntry,
  validateFeatureIndex,
  markShipped,
} from "./state.js"

// ---- helpers ---------------------------------------------------------------

function nowISO() { return new Date().toISOString() }

const VALID_NAME_RE = /^[A-Za-z0-9._-]+$/

export function validateName(name) {
  if (!name || typeof name !== "string") throw new Error("feature name is required")
  if (name === "." || name === "..") throw new Error(`invalid feature name "${name}"`)
  if (!VALID_NAME_RE.test(name)) {
    throw new Error(`invalid feature name "${name}": must match ${VALID_NAME_RE} (letters, digits, dot, underscore, hyphen)`)
  }
  if (name.startsWith(".") || name.endsWith(".")) {
    throw new Error(`invalid feature name "${name}": must not start or end with "."`)
  }
  if (name.length > 64) throw new Error(`invalid feature name "${name}": must be 64 chars or fewer`)
}

/**
 * Resolve the main (bare/shared) repo root from any git worktree.
 * Uses `git rev-parse --path-format=absolute --git-common-dir` to find the
 * shared .git directory, then returns its parent (the main repo).
 * Falls back to repoDir if not inside a git worktree.
 * @param {string} repoDir
 * @returns {string}
 */
export function resolveMainRepo(repoDir) {
  const r = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repoDir, encoding: "utf8" })
  if (r.status !== 0) {
    console.error("armada feature: current directory is not inside a git repository.")
    console.error("Run `git init` to initialize one, or `armada new <name>` to create a new project.")
    process.exitCode = 1
    throw new Error("not a git repository")
  }
  const commonDir = r.stdout.trim()
  // commonDir ends in "/.git" — main repo is its parent
  if (commonDir.endsWith("/.git")) return commonDir.slice(0, -5)
  if (commonDir.endsWith(".git")) return commonDir.slice(0, -4)
  return repoDir
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8")
}

function appendJsonl(path, obj) {
  appendFileSync(path, JSON.stringify(obj) + "\n", "utf8")
}

// ---- contract stub ---------------------------------------------------------

/**
 * Generate a contract stub markdown string.
 * @param {string} name - feature name
 * @param {{ phases: Array<{id: string, title: string, dependsOn: string[], criteria: Array<{id: string, text: string}>}> }} [phaseGraph]
 * @returns {string}
 */
export function contractStub(name, phaseGraph) {
  const phases = (phaseGraph && phaseGraph.phases && phaseGraph.phases.length > 0)
    ? phaseGraph.phases
    : [{ id: "phase-1", title: "Implementation", dependsOn: [], criteria: [{ id: "c1", text: "All tests pass" }] }]

  let out = `# ${name}\n\n## Goal\n\n<describe the feature goal>\n\n## Final criteria\n\n`
  for (const phase of phases) {
    for (const c of phase.criteria) {
      out += `- [ ] ${c.text}\n  Evidence: \n`
    }
  }
  out += `\n`

  for (const phase of phases) {
    out += `## ${phase.id} — ${phase.title}\n\n`
    out += `- **Depends on:** ${phase.dependsOn.length ? phase.dependsOn.join(", ") : "none"}\n`
    out += `- **Goal:** <describe the phase goal>\n`
    out += `- **Success criteria:**\n`
    for (const c of phase.criteria) {
      out += `  - [ ] ${c.text}\n`
    }
    out += `\n`
  }

  return out
}

// ---- evidence extraction ---------------------------------------------------

/**
 * Parse a contract markdown string and extract final criteria with their evidence.
 * Returns an array of { text, evidence: string|null }.
 * @param {string} markdown
 * @returns {Array<{ text: string, evidence: string|null }>}
 */
export function extractFinalCriteriaEvidence(markdown) {
  const lines = markdown.split("\n")

  // Count ## Final criteria headings; reject if more than one
  let finalCriteriaCount = 0
  for (const line of lines) {
    if (/^##\s+Final criteria/i.test(line.trim())) {
      finalCriteriaCount++
    }
  }
  if (finalCriteriaCount > 1) {
    throw new Error(`refusing to parse: contract has multiple "## Final criteria" sections`)
  }

  const criteria = []

  let inFinalCriteria = false
  let currentCriterion = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (/^##\s+Final criteria/i.test(trimmed)) {
      inFinalCriteria = true
      continue
    }

    if (inFinalCriteria && /^##/.test(trimmed)) {
      // next section — stop
      break
    }

    if (!inFinalCriteria) continue

    // Match criterion line: "- [ ] text" or "- [x] text"
    const criterionMatch = trimmed.match(/^-\s+\[.\]\s+(.+)/)
    if (criterionMatch) {
      if (currentCriterion) {
        criteria.push(currentCriterion)
      }
      currentCriterion = { text: criterionMatch[1], evidence: null }
      continue
    }

    // Evidence line after a criterion
    if (currentCriterion && currentCriterion.evidence === null) {
      const evidenceMatch = trimmed.match(/^Evidence:\s*(.+)/)
      if (evidenceMatch) {
        const ev = evidenceMatch[1].trim()
        currentCriterion.evidence = ev !== "" ? ev : null
      }
    }
  }

  if (currentCriterion) {
    criteria.push(currentCriterion)
  }

  return criteria
}

// ---- feature index I/O -----------------------------------------------------

function readFeatureIndex(repoDir) {
  const indexPath = join(repoDir, "armada", "state", "features", "index.json")
  if (!existsSync(indexPath)) return []
  const raw = readJson(indexPath)
  return validateFeatureIndex(raw)
}

function writeFeatureIndex(repoDir, index) {
  const dir = join(repoDir, "armada", "state", "features")
  ensureDir(dir)
  writeJson(join(dir, "index.json"), index)
}

/**
 * Read the global feature index from the main repo.
 * @param {string} mainRepo
 * @returns {Array<{ name: string, status: string, contract: string, worktree?: string, branch?: string }>}
 */
function readGlobalIndex(mainRepo) {
  return readFeatureIndex(mainRepo)
}

/**
 * Write the global feature index to the main repo.
 * @param {string} mainRepo
 * @param {Array} index
 */
function writeGlobalIndex(mainRepo, index) {
  writeFeatureIndex(mainRepo, index)
}

export function readFeatureEntry(repoDir, name) {
  const mainRepo = resolveMainRepo(repoDir)
  const path = join(mainRepo, "armada", "state", "features", `${name}.json`)
  if (!existsSync(path)) return null
  return validateFeatureIndexEntry(readJson(path))
}

function writeFeatureEntry(repoDir, entry) {
  const dir = join(repoDir, "armada", "state", "features")
  ensureDir(dir)
  writeJson(join(dir, `${entry.name}.json`), entry)
}

// ---- public API ------------------------------------------------------------

/**
 * Create a new feature: write contract stub, register in index, set active, log history.
 * @param {string} repoDir
 * @param {string} name
 * @param {{ phaseGraph?: object }} [options]
 * @returns {{ contractPath: string, entryPath: string, indexPath: string, activePath: string }}
 */
export function createFeature(repoDir, name, options = {}) {
  validateName(name)

  // Check if feature already exists — refuse unless --force
  const contractsDir = join(repoDir, "armada", "contracts")
  const contractPath = join(contractsDir, `${name}.md`)
  if (!options.force && existsSync(contractPath)) {
    throw new Error(`feature "${name}" already exists at ${contractPath}. Use --force to overwrite.`)
  }

  // Refuse in-tree feature creation from inside a worktree (DEF-005)
  // Use realpath to handle macOS /tmp → /private/tmp symlink
  const mainRepo = resolveMainRepo(repoDir)
  if (realpathSync(mainRepo) !== realpathSync(repoDir)) {
    throw new Error("cannot create in-tree feature from inside a worktree (use --worktree or run from main repo)")
  }

  ensureDir(contractsDir)

  const contractContent = contractStub(name, options.phaseGraph)
  writeFileSync(contractPath, contractContent, "utf8")

  const phaseGraph = (options.phaseGraph && options.phaseGraph.phases)
    ? options.phaseGraph
    : { phases: [{ id: "phase-1", title: "Implementation", dependsOn: [], status: "pending", criteria: [{ id: "c1", text: "All tests pass", evidence: null }] }] }

  const entry = emptyFeatureIndexEntry(name, `armada/contracts/${name}.md`, phaseGraph)
  writeFeatureEntry(repoDir, entry)

  let index = readFeatureIndex(repoDir)
  // Remove existing entry for this name to avoid duplicates
  index = index.filter((e) => e.name !== name)
  index.push({ name, status: entry.status, contract: `armada/contracts/${name}.md` })
  writeFeatureIndex(repoDir, index)

  const active = emptyActive(name, `armada/contracts/${name}.md`, phaseGraph)
  const activePath = join(repoDir, "armada", "state", "active.json")
  ensureDir(join(repoDir, "armada", "state"))
  writeJson(activePath, active)

  const historyDir = join(repoDir, "armada", "state", "history")
  ensureDir(historyDir)
  appendJsonl(join(historyDir, `${name}.jsonl`), {
    event: options.force ? "recreated" : "created",
    name,
    at: nowISO(),
  })

  return {
    contractPath,
    entryPath: join(repoDir, "armada", "state", "features", `${name}.json`),
    indexPath: join(repoDir, "armada", "state", "features", "index.json"),
    activePath,
  }
}

/**
 * Create a new feature in a git worktree on branch feat/<name>.
 * Validates name, verifies repo is a git worktree, runs `git worktree add`,
 * then scaffolds the contract and registry inside the worktree.
 * @param {string} repoDir
 * @param {string} name
 * @param {{ phaseGraph?: object }} [options]
 * @returns {{ worktreePath: string, branch: string, contractPath: string, entryPath: string, indexPath: string, activePath: string }}
 */
export async function createWorktreeFeature(repoDir, name, options = {}) {
  validateName(name)

  // Refuse nested worktree: target is itself inside a worktree
  if (!existsSync(repoDir)) {
    throw new Error(`target directory does not exist: ${repoDir}`)
  }
  const mainRepo = resolveMainRepo(repoDir)
  const toplevel = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: repoDir, encoding: "utf8" })
  const toplevelAbs = toplevel.status === 0 ? toplevel.stdout.trim() : null
  if (toplevelAbs && realpathSync(toplevelAbs) !== realpathSync(mainRepo)) {
    throw new Error("cannot create a worktree from inside another worktree (nested lanes are not allowed)")
  }

  // Verify we're inside a git working tree
  const revParse = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: repoDir, encoding: "utf8" })
  if (revParse.status !== 0 || revParse.stdout.trim() !== "true") {
    console.error("armada feature: current directory is not inside a git working tree.")
    console.error("Run `git init` to initialize one, or `armada new <name>` to create a new project.")
    process.exitCode = 1
    throw new Error("not inside a git working tree")
  }

  const branch = `feat/${name}`
  const worktreePath = join(mainRepo, "sandbox", name)

  // Run git worktree add
  const addResult = spawnSync("git", ["worktree", "add", "-b", branch, worktreePath], { cwd: repoDir, encoding: "utf8" })
  if (addResult.status !== 0) {
    const stderr = (addResult.stderr || addResult.stdout || "").trim()
    if (stderr.includes("already exists") || stderr.includes("already checked out")) {
      throw new Error(`worktree or branch already exists: ${branch}`)
    }
    throw new Error(`git worktree add failed: ${stderr}`)
  }

  // Scaffold inside the worktree
  const contractsDir = join(worktreePath, "armada", "contracts")
  ensureDir(contractsDir)

  const contractPath = join(contractsDir, `${name}.md`)
  const contractContent = contractStub(name, options.phaseGraph)
  writeFileSync(contractPath, contractContent, "utf8")

  const phaseGraph = (options.phaseGraph && options.phaseGraph.phases)
    ? options.phaseGraph
    : { phases: [{ id: "phase-1", title: "Implementation", dependsOn: [], status: "pending", criteria: [{ id: "c1", text: "All tests pass", evidence: null }] }] }

  const entry = emptyFeatureIndexEntry(name, `armada/contracts/${name}.md`, phaseGraph)
  writeFeatureEntry(worktreePath, entry)

  let index = readFeatureIndex(worktreePath)
  index = index.filter((e) => e.name !== name)
  index.push({ name, status: entry.status, contract: `armada/contracts/${name}.md` })
  writeFeatureIndex(worktreePath, index)

  const active = emptyActive(name, `armada/contracts/${name}.md`, phaseGraph)
  const activePath = join(worktreePath, "armada", "state", "active.json")
  ensureDir(join(worktreePath, "armada", "state"))
  writeJson(activePath, active)

  const historyDir = join(worktreePath, "armada", "state", "history")
  ensureDir(historyDir)
  appendJsonl(join(historyDir, `${name}.jsonl`), {
    event: "created",
    name,
    worktree: `sandbox/${name}`,
    branch: `feat/${name}`,
    at: nowISO(),
  })

  // Append to the global registry in the main repo so feature list can see
  // worktree features from any location.
  let gIndex = readGlobalIndex(mainRepo)
  gIndex = gIndex.filter((e) => e.name !== name)
  gIndex.push({
    name,
    status: entry.status,
    contract: `armada/contracts/${name}.md`,
    worktree: `sandbox/${name}`,
    branch: `feat/${name}`,
  })
  writeGlobalIndex(mainRepo, gIndex)

  // Also write the per-feature entry JSON in the main repo's global features dir
  // so readFeatureEntry / closeFeature can find it.
  writeFeatureEntry(mainRepo, entry)

  // Write P3 voyage state in the worktree (best-effort, don't block feature creation)
  try {
    const { createVoyageState } = await import("./state/versioned.js")
    const voyageState = createVoyageState({
      voyage: name,
      branch: `feat/${name}`,
      worktree: `sandbox/${name}`,
      contract: `armada/contracts/${name}.md`,
    })
    const stateDir = join(worktreePath, "armada", "state")
    ensureDir(stateDir)
    writeJson(join(stateDir, "voyage.json"), voyageState)
  } catch {
    // P3 state write is best-effort — don't block feature creation
  }

  return {
    worktreePath,
    branch,
    contractPath,
    entryPath: join(worktreePath, "armada", "state", "features", `${name}.json`),
    indexPath: join(worktreePath, "armada", "state", "features", "index.json"),
    activePath,
  }
}

/**
 * List features from the global registry (main repo).
 * Returns entries with optional `worktree` and `branch` fields for worktree features.
 * @param {string} repoDir
 * @returns {Array<{ name: string, status: string, contract: string, worktree?: string, branch?: string }>}
 */
export function listFeatures(repoDir) {
  const mainRepo = resolveMainRepo(repoDir)
  return readGlobalIndex(mainRepo)
}

/**
 * Close a feature: verify all final criteria have evidence, then mark shipped.
 * Optionally remove the associated worktree after shipping.
 * @param {string} repoDir
 * @param {string} name
 * @param {{ evidence?: Array<{ criterion: string, ref: string }>, removeWorktree?: boolean }} [options]
 * @returns {{ entry: object, removedWorktree: boolean }}
 */
export function closeFeature(repoDir, name, options = {}) {
  const mainRepo = resolveMainRepo(repoDir)

  // Find the feature in the global index to check for worktree field
  const gIndex = readGlobalIndex(mainRepo)
  const gEntry = gIndex.find((e) => e.name === name)

  const entry = readFeatureEntry(mainRepo, name)
  if (!entry) throw new Error(`feature "${name}" not found`)

  // Resolve contract path: for worktree features the contract lives inside
  // the worktree, relative to the main repo.
  let contractPath
  if (gEntry && gEntry.worktree) {
    contractPath = join(mainRepo, gEntry.worktree, entry.contract)
  } else {
    contractPath = join(mainRepo, entry.contract)
  }

  const historyDir = join(mainRepo, "armada", "state", "history")
  ensureDir(historyDir)

  // ---- --remove path: reordered so git removal happens BEFORE shipped writes (DEF-007) ----
  if (options.removeWorktree && gEntry && gEntry.worktree) {
    const worktreeDir = join(mainRepo, gEntry.worktree)
    const worktreeExistsOnDisk = existsSync(worktreeDir)

    if (!worktreeExistsOnDisk) {
      // DEF-004: orphaned worktree — contract + worktree are gone.
      // Skip evidence verification and git worktree remove. Just purge registries.
      console.error("warning: worktree directory not found, purging registry entries")
    } else {
      // Verify evidence before removal (precondition)
      if (!existsSync(contractPath)) throw new Error(`contract not found: ${entry.contract}`)
      const contractContent = readFileSync(contractPath, "utf8")
      const criteria = extractFinalCriteriaEvidence(contractContent)
      if (criteria.length === 0) {
        throw new Error(`refusing to close "${name}": no final criteria found in contract`)
      }
      const missing = criteria.filter((c) => !c.evidence)
      if (missing.length > 0) {
        const missingTexts = missing.map((c) => `"${c.text}"`).join(", ")
        throw new Error(`refusing to close "${name}": ${missing.length} criteria lack evidence: ${missingTexts}`)
      }

      // DEF-007: git worktree remove runs BEFORE any shipped-state writes
      const removeResult = spawnSync("git", ["worktree", "remove", "--force", worktreeDir], { cwd: mainRepo, encoding: "utf8" })
      if (removeResult.status !== 0) {
        const stderr = (removeResult.stderr || removeResult.stdout || "").trim()
        throw new Error(`git worktree remove failed: ${stderr}`)
      }
    }

    // DEF-003: delete the branch after worktree removal
    if (gEntry.branch) {
      const branchResult = spawnSync("git", ["branch", "-D", gEntry.branch], { cwd: mainRepo, encoding: "utf8" })
      if (branchResult.status !== 0) {
        // Branch may already be gone (merged or manually deleted). Log but don't throw.
        console.error(`warning: git branch -D ${gEntry.branch} failed: ${(branchResult.stderr || branchResult.stdout || "").trim()}`)
      }
    }

    // NOW write shipped state (DEF-007: only after git operations succeed)
    const shippedEntry = markShipped(entry)
    writeFeatureEntry(mainRepo, shippedEntry)

    let index = readGlobalIndex(mainRepo)
    const idxEntry = index.find((e) => e.name === name)
    if (idxEntry) {
      idxEntry.status = "shipped"
    } else {
      index.push({ name, status: "shipped", contract: entry.contract })
    }
    writeGlobalIndex(mainRepo, index)

    const activePath = join(mainRepo, "armada", "state", "active.json")
    if (existsSync(activePath)) {
      const active = readJson(activePath)
      active.nextAction = `feature "${name}" shipped`
      active.updatedAt = nowISO()
      writeJson(activePath, active)
    }

    appendJsonl(join(historyDir, `${name}.jsonl`), {
      event: "shipped",
      name,
      at: nowISO(),
      worktree: gEntry.worktree,
    })

    // Purge: remove from global index and delete per-feature file
    index = index.filter((e) => e.name !== name)
    writeGlobalIndex(mainRepo, index)

    const featureFilePath = join(mainRepo, "armada", "state", "features", `${name}.json`)
    if (existsSync(featureFilePath)) {
      unlinkSync(featureFilePath)
    }

    appendJsonl(join(historyDir, `${name}.jsonl`), {
      event: "removed",
      name,
      worktree: gEntry.worktree,
      branch: gEntry.branch,
      at: nowISO(),
    })

    return { entry: shippedEntry, removedWorktree: true }
  }

  // ---- no --remove (or no worktree): original close behavior ----
  if (!existsSync(contractPath)) throw new Error(`contract not found: ${entry.contract}`)

  const contractContent = readFileSync(contractPath, "utf8")
  const criteria = extractFinalCriteriaEvidence(contractContent)

  if (criteria.length === 0) {
    throw new Error(`refusing to close "${name}": no final criteria found in contract`)
  }

  const missing = criteria.filter((c) => !c.evidence)
  if (missing.length > 0) {
    const missingTexts = missing.map((c) => `"${c.text}"`).join(", ")
    throw new Error(`refusing to close "${name}": ${missing.length} criteria lack evidence: ${missingTexts}`)
  }

  // Mark shipped
  const shippedEntry = markShipped(entry)
  writeFeatureEntry(mainRepo, shippedEntry)

  let index = readGlobalIndex(mainRepo)
  const idxEntry = index.find((e) => e.name === name)
  if (idxEntry) {
    idxEntry.status = "shipped"
  } else {
    index.push({ name, status: "shipped", contract: entry.contract })
  }
  writeGlobalIndex(mainRepo, index)

  const activePath = join(mainRepo, "armada", "state", "active.json")
  if (existsSync(activePath)) {
    const active = readJson(activePath)
    active.nextAction = `feature "${name}" shipped`
    active.updatedAt = nowISO()
    writeJson(activePath, active)
  }

  appendJsonl(join(historyDir, `${name}.jsonl`), {
    event: "shipped",
    name,
    at: nowISO(),
    evidence: criteria.map((c) => ({ text: c.text, evidence: c.evidence })),
  })

  // Mark P3 voyage state as completed if it exists (best-effort)
  try {
    const statePath = join(mainRepo, "armada", "state", "voyage.json")
    if (existsSync(statePath)) {
      const state = readJson(statePath)
      state.status = "completed"
      state.inFlightAction = null
      state.updatedAt = nowISO()
      writeJson(statePath, state)
    }
  } catch {
    // best-effort
  }

  return { entry: shippedEntry, removedWorktree: false }
}

/**
 * Set the active contract from a contract file path.
 * @param {string} repoDir
 * @param {string} contractPath - relative path like "armada/contracts/foo.md" or "armada/REQUIREMENTS.md"
 */
export function setActiveContract(repoDir, contractPath) {
  const name = basename(contractPath, ".md")
  const stateDir = join(repoDir, "armada", "state")
  ensureDir(stateDir)

  // Try to read feature entry if it exists
  const entry = readFeatureEntry(repoDir, name)
  let phaseGraph = { phases: [] }
  if (entry) {
    phaseGraph = { phases: entry.phases.map((p) => ({ id: p.id, title: p.id, dependsOn: [], status: "pending", criteria: [] })) }
  }

  const active = emptyActive(name, contractPath, phaseGraph)
  writeJson(join(stateDir, "active.json"), active)
}

/**
 * Read the active state.
 * @param {string} repoDir
 * @returns {object|null}
 */
export function readActive(repoDir) {
  const activePath = join(repoDir, "armada", "state", "active.json")
  if (!existsSync(activePath)) return null
  return readJson(activePath)
}
