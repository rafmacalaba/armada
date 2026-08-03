/**
 * reconcile — pure read-only engine that diffs on-disk state against the
 * active feature contract and reports a ResumePlan.
 *
 * @module reconcile
 */

import { readFileSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"

// ---- constants -------------------------------------------------------------

const FAILURE_MARKERS = [
  /\bFAIL\b/,
  /\bfailed\b/i,
  /^not ok\b/m,
  /^# fail\b/m,
  /\bError\b/,
  /assertion error/i,
  /\b[1-9]\d*\s+failing\b/,
]

// ---- contract parsing ------------------------------------------------------

/**
 * Parse contract markdown into a structured map.
 * Returns { phaseCriteria: Map<phaseId, {text, ticked}[]>, finalCriteria: {text, ticked}[] }
 */
function parseContract(md) {
  const lines = md.split("\n")
  const phaseCriteria = new Map()
  let currentPhase = null
  let inSuccessCriteria = false

  for (const raw of lines) {
    const line = raw.trim()

    // Phase heading: "## phase-1 — Title" or "## Phase 1 — Title"
    const phaseMatch = line.match(/^##\s+(\S+(?:-\d+)?)\s*[-—].*$/)
    if (phaseMatch && !/final criteria/i.test(line)) {
      currentPhase = phaseMatch[1]
      inSuccessCriteria = false
      if (!phaseCriteria.has(currentPhase)) {
        phaseCriteria.set(currentPhase, [])
      }
      continue
    }

    // "Final criteria" section — skip (handled separately via phase status)
    if (/^##\s+final criteria/i.test(line)) {
      currentPhase = null
      inSuccessCriteria = false
      continue
    }

    // Other headings reset context
    if (/^##/.test(line)) {
      currentPhase = null
      inSuccessCriteria = false
      continue
    }

    // Detect "Success criteria:" marker
    if (/^\*\*Success criteria:\*\*/i.test(line) || /^- \*\*Success criteria:\*\*/i.test(line)) {
      inSuccessCriteria = true
      continue
    }

    if (currentPhase && inSuccessCriteria) {
      // Criterion line: "- [ ] text" or "- [x] text"
      const criterionMatch = line.match(/^-\s+\[([ xX])\]\s+(.+)/)
      if (criterionMatch) {
        phaseCriteria.get(currentPhase).push({
          text: criterionMatch[2],
          ticked: criterionMatch[1].toLowerCase() === "x",
        })
      }
    }
  }

  return { phaseCriteria }
}

// ---- evidence checking -----------------------------------------------------

/**
 * Check if a test/log evidence file indicates failure.
 */
function evidenceShowsFailure(content) {
  return FAILURE_MARKERS.some((re) => re.test(content))
}

/**
 * Check evidence for a criterion. Returns a drift object or null.
 */
function checkEvidence(kind, ref, repoRoot, fs) {
  if (!ref) {
    return { kind: "evidence-missing", detail: "criterion has no evidence.ref" }
  }

  const fullPath = join(repoRoot, ref)

  if (!fs.existsSync(fullPath)) {
    return { kind: "evidence-missing", ref }
  }

  // Evidence path is a directory — cannot be read as content
  try {
    const st = fs.statSync(fullPath)
    if (st.isDirectory()) {
      return { kind: "evidence-missing", ref, detail: `path is a directory: ${ref}` }
    }
  } catch {
    return { kind: "evidence-missing", ref, detail: `cannot stat: ${ref}` }
  }

  // For test/log evidence, check if the output indicates failure
  if (kind === "test" || kind === "log") {
    try {
      const content = fs.readFileSync(fullPath, "utf8")
      if (evidenceShowsFailure(content)) {
        return { kind: "evidence-failed", ref }
      }
    } catch {
      return { kind: "evidence-missing", ref }
    }
  }

  // For screenshot and file:line, existence = ok
  return null
}

// ---- phase helpers ---------------------------------------------------------

/**
 * Get the current phase: first phase with status "in_progress", or first
 * "pending" phase whose dependencies are satisfied.
 */
function findCurrentPhase(phases) {
  // Prefer in_progress
  for (const p of phases) {
    if (!p || typeof p !== "object") continue
    if (p.status === "in_progress") return p
  }
  // First pending with deps met
  for (const p of phases) {
    if (!p || typeof p !== "object") continue
    if (p.status !== "pending") continue
    const depsMet = p.dependsOn.every(
      (depId) => phases.find((dp) => dp && dp.id === depId)?.status === "passed"
    )
    if (depsMet) return p
  }
  // All phases passed — return last
  for (let i = phases.length - 1; i >= 0; i--) {
    if (phases[i] && typeof phases[i] === "object") return phases[i]
  }
  return null
}

/**
 * All phases passed?
 */
function allPhasesPassed(phases) {
  return phases.length > 0 && phases.every((p) => p && p.status === "passed")
}

// ---- main export -----------------------------------------------------------

/**
 * Reconcile on-disk state against the active feature contract.
 *
 * @param {string} stateDir - path to armada/state/
 * @param {string} repoRoot - repo root (for resolving evidence + contract paths)
 * @param {{ fs?: { readFileSync: Function, existsSync: Function } }} [opts]
 * @returns {ResumePlan}
 */
export function reconcile(stateDir, repoRoot, opts = {}) {
  const fs = opts.fs || { readFileSync, existsSync, statSync }

  const activePath = join(stateDir, "active.json")
  if (!fs.existsSync(activePath)) {
    return {
      activeFeature: null,
      currentPhase: null,
      drifts: [],
      resumeLine: "resume: no active feature",
      generatedAt: new Date().toISOString(),
    }
  }

  let active
  try {
    active = JSON.parse(fs.readFileSync(activePath, "utf8"))
  } catch {
    return {
      activeFeature: null,
      currentPhase: null,
      drifts: [],
      resumeLine: "resume: no active feature",
      generatedAt: new Date().toISOString(),
    }
  }

  if (!active || !active.feature) {
    return {
      activeFeature: null,
      currentPhase: null,
      drifts: [],
      resumeLine: "resume: no active feature",
      generatedAt: new Date().toISOString(),
    }
  }

  const phases = active.phaseGraph?.phases || []

  // Read contract
  let contractMd = ""
  const contractPath = join(repoRoot, active.contract || "")
  if (active.contract && fs.existsSync(contractPath)) {
    try {
      contractMd = fs.readFileSync(contractPath, "utf8")
    } catch {
      // contract unreadable — proceed without it
    }
  }

  const { phaseCriteria } = parseContract(contractMd)

  const drifts = []

  // Phase-level drifts
  const PHASE_STATUS_ORDER = ["passed", "in_progress", "pending"]

  for (const phase of phases) {
    if (!phase || typeof phase !== "object") continue
    const contractCriteria = phaseCriteria.get(phase.id) || []

    const criteria = Array.isArray(phase.criteria) ? phase.criteria : []
    for (const crit of criteria) {
      // Evidence drift checks
      if (crit.evidence) {
        const drift = checkEvidence(crit.evidence.kind, crit.evidence.ref, repoRoot, fs)
      if (drift) {
        const entry = {
          kind: drift.kind,
          phase: phase.id,
          criterion: crit.id,
          ref: crit.evidence.ref,
        }
        if (drift.detail) entry.detail = drift.detail
        drifts.push(entry)
      }
      }

      // Criterion-unticked: phase is passed but criterion not ticked in contract
      // We match criteria by index position
      const idx = phase.criteria.indexOf(crit)
      if (phase.status === "passed" && idx < contractCriteria.length) {
        if (!contractCriteria[idx].ticked) {
          // Avoid duplicate: only if not already flagged as evidence drift
          const alreadyFlagged = drifts.some(
            (d) => d.phase === phase.id && d.criterion === crit.id && d.kind === "criterion-unticked"
          )
          if (!alreadyFlagged) {
            drifts.push({
              kind: "criterion-unticked",
              phase: phase.id,
              criterion: crit.id,
              ref: `${active.contract}#${phase.id}`,
            })
          }
        }
      }
    }
  }

  // Current phase
  const currentPhase = findCurrentPhase(phases)

  // Next action
  let nextAction = ""
  if (currentPhase) {
    const currentContractCriteria = phaseCriteria.get(currentPhase.id) || []
    const firstUnchecked = currentContractCriteria.find((c) => !c.ticked)
    if (firstUnchecked) {
      nextAction = `"${firstUnchecked.text}"`
    } else {
      // All criteria in current phase ticked — check next phase
      const phaseIdx = phases.indexOf(currentPhase)
      // Find next non-null phase after current
      let nextPhase = null
      for (let i = phaseIdx + 1; i < phases.length; i++) {
        if (phases[i] && typeof phases[i] === "object") {
          nextPhase = phases[i]
          break
        }
      }
      if (nextPhase) {
        const nextContractCriteria = phaseCriteria.get(nextPhase.id) || []
        const nextUnchecked = nextContractCriteria.find((c) => !c.ticked)
        nextAction = nextUnchecked
          ? `"${nextUnchecked.text}" (phase ${nextPhase.id})`
          : `continue to next phase`
      } else if (allPhasesPassed(phases)) {
        nextAction = "feature ready to close"
      } else {
        nextAction = "continue to next phase"
      }
    }
  }

  // Resume line
  const evidenceCount = active.evidence?.length || 0
  const resumeLine = currentPhase
    ? `resume: feature ${active.feature}, phase ${currentPhase.id} (${currentPhase.status}), evidence ${evidenceCount} in, drift ${drifts.length}, next ${nextAction}`
    : `resume: feature ${active.feature}, phase <none>, evidence ${evidenceCount} in, drift ${drifts.length}, next <bootstrap phase graph>`

  return {
    activeFeature: active.feature,
    currentPhase: currentPhase?.id || null,
    drifts,
    resumeLine,
    generatedAt: new Date().toISOString(),
  }
}
