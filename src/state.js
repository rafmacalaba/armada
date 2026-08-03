/**
 * armada state schema — pure module, zero I/O.
 *
 * @module state
 */

// ---- type defs -----------------------------------------------------------

/**
 * @typedef {"test"|"screenshot"|"log"|"file:line"} EvidenceKind
 */

/**
 * @typedef {{ kind: EvidenceKind, ref: string }} CriterionEvidence
 */

/**
 * @typedef {{ id: string, text: string, evidence: null | CriterionEvidence }} PhaseCriterion
 */

/**
 * @typedef {"pending"|"in_progress"|"passed"} PhaseStatus
 */

/**
 * @typedef {{ id: string, title: string, dependsOn: string[], status: PhaseStatus, criteria: PhaseCriterion[] }} Phase
 */

/**
 * @typedef {{ feature: string, contract: string, phaseGraph: { phases: Phase[] }, evidence: Evidence[], nextAction: string, updatedAt: string }} ActiveState
 */

/**
 * @typedef {{ phase: string, criterion: string, kind: EvidenceKind, ref: string }} Evidence
 */

/**
 * @typedef {"open"|"in_progress"|"shipped"} FeatureStatus
 */

/**
 * @typedef {{ name: string, status: FeatureStatus, contract: string, createdAt: string, updatedAt: string, shippedAt: null | string, phases: { id: string, status: string }[] }} FeatureIndexEntry
 */

/**
 * @typedef {{ name: string, status: string, contract: string }} FeatureIndexItem
 */

// ---- constants -----------------------------------------------------------

const VALID_EVIDENCE_KINDS = new Set(["test", "screenshot", "log", "file:line"])
const VALID_PHASE_STATUSES = new Set(["pending", "in_progress", "passed"])
const VALID_FEATURE_STATUSES = new Set(["open", "in_progress", "shipped"])

// ---- helpers -------------------------------------------------------------

function nowISO() { return new Date().toISOString() }

function checkNonEmptyString(val, path) {
  if (typeof val !== "string" || val === "") throw new Error(`${path}: must be a non-empty string`)
}

function checkString(val, path) {
  if (typeof val !== "string") throw new Error(`${path}: must be a string`)
}

function checkArray(val, path) {
  if (!Array.isArray(val)) throw new Error(`${path}: must be an array`)
}

function checkObject(val, path) {
  if (val === null || typeof val !== "object" || Array.isArray(val)) throw new Error(`${path}: must be a plain object`)
}

// ---- evidence validation -------------------------------------------------

function checkEvidence(ev, path) {
  checkObject(ev, path)
  checkNonEmptyString(ev.kind, `${path}.kind`)
  if (!VALID_EVIDENCE_KINDS.has(ev.kind)) throw new Error(`${path}.kind: must be one of test|screenshot|log|file:line`)
  checkNonEmptyString(ev.ref, `${path}.ref`)
}

function checkCriterionEvidence(ev, path) {
  if (ev !== null) checkEvidence(ev, path)
}

// ---- phase graph ----------------------------------------------------------

function checkPhase(p, path) {
  checkObject(p, path)
  checkNonEmptyString(p.id, `${path}.id`)
  checkNonEmptyString(p.title, `${path}.title`)
  checkArray(p.dependsOn, `${path}.dependsOn`)
  for (let i = 0; i < p.dependsOn.length; i++) {
    checkNonEmptyString(p.dependsOn[i], `${path}.dependsOn[${i}]`)
  }
  checkNonEmptyString(p.status, `${path}.status`)
  if (!VALID_PHASE_STATUSES.has(p.status)) throw new Error(`${path}.status: must be one of pending|in_progress|passed`)
  checkArray(p.criteria, `${path}.criteria`)
  for (let i = 0; i < p.criteria.length; i++) {
    checkObject(p.criteria[i], `${path}.criteria[${i}]`)
    checkNonEmptyString(p.criteria[i].id, `${path}.criteria[${i}].id`)
    checkNonEmptyString(p.criteria[i].text, `${path}.criteria[${i}].text`)
    checkCriterionEvidence(p.criteria[i].evidence, `${path}.criteria[${i}].evidence`)
  }
}

function checkPhaseGraph(pg, path) {
  checkObject(pg, path)
  checkArray(pg.phases, `${path}.phases`)
  const ids = new Set()
  for (let i = 0; i < pg.phases.length; i++) {
    checkPhase(pg.phases[i], `${path}.phases[${i}]`)
    if (ids.has(pg.phases[i].id)) throw new Error(`${path}: duplicate phase id "${pg.phases[i].id}"`)
    ids.add(pg.phases[i].id)
  }
  // acyclicity check
  for (const phase of pg.phases) {
    for (const dep of phase.dependsOn) {
      if (!ids.has(dep)) throw new Error(`${path}: phase "${phase.id}" depends on unknown phase "${dep}"`)
    }
  }
  validateAcyclic(pg.phases)
}

function validateAcyclic(phases) {
  const ids = phases.map((p) => p.id)
  const idx = new Map(ids.map((id, i) => [id, i]))
  const adj = phases.map((p) => p.dependsOn.filter((d) => idx.has(d)).map((d) => idx.get(d)))

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Array(phases.length).fill(WHITE)

  function dfs(u) {
    color[u] = GRAY
    for (const v of adj[u]) {
      if (color[v] === GRAY) throw new Error(`phaseGraph: cycle detected involving "${ids[u]}" and "${ids[v]}"`)
      if (color[v] === WHITE) dfs(v)
    }
    color[u] = BLACK
  }

  for (let i = 0; i < phases.length; i++) {
    if (color[i] === WHITE) dfs(i)
  }
}

// ---- public API ----------------------------------------------------------

/**
 * Validate an active state object. Returns the state on success, throws on failure.
 * @param {unknown} obj
 * @returns {ActiveState}
 */
export function validateState(obj) {
  checkObject(obj, "state")
  checkNonEmptyString(obj.feature, "state.feature")
  checkNonEmptyString(obj.contract, "state.contract")
  checkPhaseGraph(obj.phaseGraph, "state.phaseGraph")
  checkArray(obj.evidence, "state.evidence")
  for (let i = 0; i < obj.evidence.length; i++) {
    checkEvidence(obj.evidence[i], `state.evidence[${i}]`)
    checkNonEmptyString(obj.evidence[i].phase, `state.evidence[${i}].phase`)
    checkNonEmptyString(obj.evidence[i].criterion, `state.evidence[${i}].criterion`)
  }
  checkString(obj.nextAction, "state.nextAction")
  checkNonEmptyString(obj.updatedAt, "state.updatedAt")
  return obj
}

/**
 * Validate a feature index entry.
 * @param {unknown} obj
 * @returns {FeatureIndexEntry}
 */
export function validateFeatureIndexEntry(obj) {
  checkObject(obj, "indexEntry")
  checkNonEmptyString(obj.name, "indexEntry.name")
  checkNonEmptyString(obj.status, "indexEntry.status")
  if (!VALID_FEATURE_STATUSES.has(obj.status)) throw new Error("indexEntry.status: must be one of open|in_progress|shipped")
  checkNonEmptyString(obj.contract, "indexEntry.contract")
  checkNonEmptyString(obj.createdAt, "indexEntry.createdAt")
  checkNonEmptyString(obj.updatedAt, "indexEntry.updatedAt")
  if (obj.shippedAt !== null) checkNonEmptyString(obj.shippedAt, "indexEntry.shippedAt")
  checkArray(obj.phases, "indexEntry.phases")
  for (let i = 0; i < obj.phases.length; i++) {
    checkObject(obj.phases[i], `indexEntry.phases[${i}]`)
    checkNonEmptyString(obj.phases[i].id, `indexEntry.phases[${i}].id`)
    checkNonEmptyString(obj.phases[i].status, `indexEntry.phases[${i}].status`)
  }
  return obj
}

/**
 * Validate a feature index array (for index.json).
 * @param {unknown} arr
 * @returns {FeatureIndexItem[]}
 */
export function validateFeatureIndex(arr) {
  checkArray(arr, "featureIndex")
  for (let i = 0; i < arr.length; i++) {
    checkObject(arr[i], `featureIndex[${i}]`)
    checkNonEmptyString(arr[i].name, `featureIndex[${i}].name`)
    checkNonEmptyString(arr[i].status, `featureIndex[${i}].status`)
    checkNonEmptyString(arr[i].contract, `featureIndex[${i}].contract`)
  }
  return arr
}

/**
 * Create a fresh active state object.
 * @param {string} featureName
 * @param {string} contractPath
 * @param {{ phases: Phase[] }} phaseGraph
 * @returns {ActiveState}
 */
export function emptyActive(featureName, contractPath, phaseGraph) {
  return {
    feature: featureName,
    contract: contractPath,
    phaseGraph,
    evidence: [],
    nextAction: "",
    updatedAt: nowISO(),
  }
}

/**
 * Create a fresh feature index entry.
 * @param {string} name
 * @param {string} contractPath
 * @param {{ phases: Phase[] }} phaseGraph
 * @returns {FeatureIndexEntry}
 */
export function emptyFeatureIndexEntry(name, contractPath, phaseGraph) {
  const now = nowISO()
  return {
    name,
    status: "open",
    contract: contractPath,
    createdAt: now,
    updatedAt: now,
    shippedAt: null,
    phases: phaseGraph.phases.map((p) => ({ id: p.id, status: "pending" })),
  }
}

/**
 * Apply evidence to a criterion. Returns a new state with the evidence applied.
 * Original state is not mutated.
 * @param {ActiveState} state
 * @param {{ phaseId: string, criterionId: string, kind: EvidenceKind, ref: string }} evidence
 * @returns {ActiveState}
 */
export function applyEvidence(state, { phaseId, criterionId, kind, ref }) {
  const newState = structuredClone(state)
  const phase = newState.phaseGraph.phases.find((p) => p.id === phaseId)
  if (!phase) throw new Error(`applyEvidence: phase "${phaseId}" not found`)
  const criterion = phase.criteria.find((c) => c.id === criterionId)
  if (!criterion) throw new Error(`applyEvidence: criterion "${criterionId}" not found in phase "${phaseId}"`)
  criterion.evidence = { kind, ref }
  newState.evidence.push({ phase: phaseId, criterion: criterionId, kind, ref })
  newState.updatedAt = nowISO()
  return newState
}

/**
 * Set phase status. Returns a new state. Original state is not mutated.
 * @param {ActiveState} state
 * @param {string} phaseId
 * @param {PhaseStatus} status
 * @returns {ActiveState}
 */
export function setPhaseStatus(state, phaseId, status) {
  if (!VALID_PHASE_STATUSES.has(status)) throw new Error(`setPhaseStatus: invalid status "${status}"`)
  const newState = structuredClone(state)
  const phase = newState.phaseGraph.phases.find((p) => p.id === phaseId)
  if (!phase) throw new Error(`setPhaseStatus: phase "${phaseId}" not found`)
  phase.status = status
  newState.updatedAt = nowISO()
  return newState
}

/**
 * Set next action. Returns a new state. Original state is not mutated.
 * @param {ActiveState} state
 * @param {string} action
 * @returns {ActiveState}
 */
export function setNextAction(state, action) {
  const newState = structuredClone(state)
  newState.nextAction = action
  newState.updatedAt = nowISO()
  return newState
}

/**
 * Mark a feature index entry as shipped.
 * @param {FeatureIndexEntry} entry
 * @returns {FeatureIndexEntry}
 */
export function markShipped(entry) {
  const newEntry = structuredClone(entry)
  newEntry.status = "shipped"
  newEntry.shippedAt = nowISO()
  newEntry.updatedAt = nowISO()
  return newEntry
}
