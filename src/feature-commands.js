/**
 * armada feature-commands — file-I/O wrappers around src/state.js.
 *
 * @module feature-commands
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs"
import { join, basename } from "node:path"
import {
  emptyActive,
  emptyFeatureIndexEntry,
  validateFeatureIndexEntry,
  validateFeatureIndex,
  markShipped,
} from "./state.js"

// ---- helpers ---------------------------------------------------------------

function nowISO() { return new Date().toISOString() }

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

export function readFeatureEntry(repoDir, name) {
  const path = join(repoDir, "armada", "state", "features", `${name}.json`)
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
  if (!name || typeof name !== "string") throw new Error("feature name is required")

  const contractsDir = join(repoDir, "armada", "contracts")
  ensureDir(contractsDir)

  const contractPath = join(contractsDir, `${name}.md`)
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
    event: "created",
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
 * List features from the index.
 * @param {string} repoDir
 * @returns {Array<{ name: string, status: string, contract: string }>}
 */
export function listFeatures(repoDir) {
  return readFeatureIndex(repoDir)
}

/**
 * Close a feature: verify all final criteria have evidence, then mark shipped.
 * @param {string} repoDir
 * @param {string} name
 * @param {{ evidence?: Array<{ criterion: string, ref: string }> }} [options]
 * @returns {{ entry: object }}
 */
export function closeFeature(repoDir, name, options = {}) {
  const entry = readFeatureEntry(repoDir, name)
  if (!entry) throw new Error(`feature "${name}" not found`)

  const contractPath = join(repoDir, entry.contract)
  if (!existsSync(contractPath)) throw new Error(`contract not found: ${entry.contract}`)

  const contractContent = readFileSync(contractPath, "utf8")
  const criteria = extractFinalCriteriaEvidence(contractContent)

  // Check if there are any final criteria at all
  if (criteria.length === 0) {
    throw new Error(`refusing to close "${name}": no final criteria found in contract`)
  }

  // Collect criteria lacking evidence
  const missing = criteria.filter((c) => !c.evidence)
  if (missing.length > 0) {
    const missingTexts = missing.map((c) => `"${c.text}"`).join(", ")
    throw new Error(`refusing to close "${name}": ${missing.length} criteria lack evidence: ${missingTexts}`)
  }

  // Merge provided evidence into contract? No — contract is source of truth. We just verify.
  const shippedEntry = markShipped(entry)
  writeFeatureEntry(repoDir, shippedEntry)

  // Update index
  let index = readFeatureIndex(repoDir)
  const idxEntry = index.find((e) => e.name === name)
  if (idxEntry) {
    idxEntry.status = "shipped"
  } else {
    index.push({ name, status: "shipped", contract: entry.contract })
  }
  writeFeatureIndex(repoDir, index)

  // Update active.json
  const activePath = join(repoDir, "armada", "state", "active.json")
  if (existsSync(activePath)) {
    const active = readJson(activePath)
    active.nextAction = `feature "${name}" shipped`
    active.updatedAt = nowISO()
    writeJson(activePath, active)
  }

  // Append to history
  const historyDir = join(repoDir, "armada", "state", "history")
  ensureDir(historyDir)
  appendJsonl(join(historyDir, `${name}.jsonl`), {
    event: "shipped",
    name,
    at: nowISO(),
    evidence: criteria.map((c) => ({ text: c.text, evidence: c.evidence })),
  })

  return { entry: shippedEntry }
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
