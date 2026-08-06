/**
 * Adaptive voyage policy — pure decisions for staffing, evidence, and gates.
 *
 * @module workflow-policy
 */

const AGENTS = ["backend-dev", "frontend-dev", "qa", "security", "adversary", "docs", "architect"]
const RISK_LEVELS = ["low", "medium", "high"]
const SEVERITIES = ["LOW", "MEDIUM", "HIGH"]

const HIGH_SIGNALS = [
  { trigger: "trust-boundary", pattern: /\b(auth|authentication|authorization|authz|secret|credential|token|password|permission|privilege)\b/i, reason: "trust boundary" },
  { trigger: "code-execution", pattern: /\b(shell|execute|command execution|code execution|remote code|subprocess)\b/i, reason: "code execution" },
  { trigger: "destructive-side-effect", pattern: /\b(delete|destructive|migration|production|payment|billing|encryption|irreversible)\b/i, reason: "high-consequence side effect" },
]

const MEDIUM_SIGNALS = [
  { trigger: "public-contract", pattern: /\b(public|cli|api|command|interface|schema)\b/i, reason: "public contract" },
  { trigger: "filesystem-boundary", pattern: /\b(file|filesystem|path|template|render|scaffold|symlink)\b/i, reason: "filesystem boundary" },
  { trigger: "external-side-effect", pattern: /\b(url|network|external|package|dependency|environment|env)\b/i, reason: "external input or side effect" },
  { trigger: "core-surface", pattern: /\b(core|generator|manifest|state|workflow|shared|cross-cutting|wide|broad)\b/i, reason: "shared core surface" },
]

function list(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string")
  if (typeof value === "string") return [value]
  return []
}

function surfaceText(surface = {}) {
  return [
    ...list(surface.files),
    ...list(surface.behaviors),
    ...list(surface.inputs),
    ...list(surface.sideEffects),
    surface.blastRadius,
    surface.reversibility,
  ].filter(Boolean).join(" ")
}

function matches(signals, text) {
  return signals.filter((signal) => signal.pattern.test(text))
}

function effectiveRisk(risk, surface) {
  const inferred = classifyRisk(surface).risk
  if (!RISK_LEVELS.includes(risk)) return inferred
  return RISK_LEVELS[Math.max(RISK_LEVELS.indexOf(risk), RISK_LEVELS.indexOf(inferred))]
}

function maxSeverity(values) {
  return values.sort((a, b) => SEVERITIES.indexOf(b) - SEVERITIES.indexOf(a))[0] ?? "LOW"
}

/**
 * Infer risk from change surface. User override is intentionally outside this
 * function so normal voyages stay autonomous and auditable.
 *
 * @param {object} surface
 * @returns {{ risk: "low"|"medium"|"high", reasons: string[], triggers: string[] }}
 */
export function classifyRisk(surface = {}) {
  const text = surfaceText(surface)
  const high = matches(HIGH_SIGNALS, text)
  const medium = matches(MEDIUM_SIGNALS, text)
  const signals = [...high, ...medium]

  return {
    risk: high.length > 0 ? "high" : medium.length > 0 ? "medium" : "low",
    reasons: signals.length > 0 ? signals.map((signal) => signal.reason) : ["isolated or documentation-only change"],
    triggers: [...new Set(signals.map((signal) => signal.trigger))],
  }
}

function primaryAgent(surface) {
  const files = list(surface.files)
  const text = surfaceText(surface)
  const docsOnly = files.length > 0 && files.every((file) => /(^|\/)(README|CHANGELOG|docs?)([^/]*|\/)/i.test(file))
    && !/code|implementation|behavior|source|test/i.test(text)
  if (docsOnly) return "docs"
  if (/\b(frontend|ui|browser|react|component|css|web)\b/i.test(text)) return "frontend-dev"
  return "backend-dev"
}

/**
 * Select active agents while keeping all non-selected roles on standby.
 * QA is always active, including low-risk work.
 *
 * @param {{ risk?: string, surface?: object }} options
 * @returns {{ activeAgents: string[], standbyAgents: string[], escalations: string[] }}
 */
export function selectAgents({ risk, surface = {} } = {}) {
  const inferred = classifyRisk(surface)
  const level = effectiveRisk(risk, surface)
  const active = [primaryAgent(surface), "qa"]
  const escalations = []
  const triggers = new Set(inferred.triggers)
  const text = surfaceText(surface)

  if (level === "high" || triggers.has("trust-boundary") || triggers.has("code-execution")) {
    active.push("security")
    escalations.push("independent-security-review")
  }
  if (level === "high") {
    active.push("adversary")
    escalations.push("independent-adversarial-review")
  }
  if (level === "high" && (triggers.has("core-surface") || /\b(cross-cutting|architecture|migration)\b/i.test(text))) {
    active.push("architect")
    escalations.push("architecture-review")
  }

  const uniqueActive = AGENTS.filter((agent) => active.includes(agent))
  return {
    activeAgents: uniqueActive,
    standbyAgents: AGENTS.filter((agent) => !uniqueActive.includes(agent)),
    escalations,
  }
}

/**
 * Map risk to proportionate evidence. QA remains the base reviewer.
 *
 * @param {{ risk?: string, surface?: object }} options
 * @returns {{ class: string, required: string[], reviewers: string[], conditionalReviewers: string[], runFullRelevantSuite: boolean }}
 */
export function evidencePolicy({ risk, surface = {} } = {}) {
  const level = effectiveRisk(risk, surface)
  if (level === "high") {
    return {
      class: "full",
      strictness: "full",
      required: ["full-relevant-suite", "negative-path-tests", "independent-review"],
      reviewers: ["qa", "security", "adversary"],
      conditionalReviewers: ["architect"],
      runFullRelevantSuite: true,
    }
  }
  if (level === "medium") {
    return {
      class: "targeted",
      strictness: "targeted",
      required: ["affected-tests", "integration-smoke"],
      reviewers: ["qa"],
      conditionalReviewers: ["security", "adversary", "architect"],
      runFullRelevantSuite: false,
    }
  }
  return {
    class: "smoke",
    strictness: "lax",
    required: ["focused-smoke", "acceptance-check"],
    reviewers: ["qa"],
    conditionalReviewers: ["security", "adversary", "architect"],
    runFullRelevantSuite: false,
  }
}

/**
 * Return every pending phase whose dependencies have passed.
 *
 * @param {{ id: string, status: string, dependsOn?: string[] }[]} phases
 * @returns {string[]}
 */
export function readyPhaseIds(phases = []) {
  const status = new Map(phases.map((phase) => [phase.id, phase.status]))
  return phases
    .filter((phase) => phase.status === "pending")
    .filter((phase) => list(phase.dependsOn).every((dependency) => status.get(dependency) === "passed"))
    .map((phase) => phase.id)
}

function related(a, b) {
  if (a.rootCause && a.rootCause === b.rootCause) return true
  if (a.threatClass && a.threatClass === b.threatClass) return true
  const filesA = new Set(list(a.files))
  return list(b.files).some((file) => filesA.has(file))
}

/**
 * Group findings that can share one remediation and verification pass.
 *
 * @param {object[]} findings
 * @returns {object[]}
 */
export function groupFindings(findings = []) {
  const groups = []
  const assigned = new Set()

  findings.forEach((finding, index) => {
    if (assigned.has(index)) return
    const members = [index]
    assigned.add(index)
    for (let next = index + 1; next < findings.length; next++) {
      if (assigned.has(next)) continue
      if (members.some((member) => related(findings[member], findings[next]))) {
        members.push(next)
        assigned.add(next)
      }
    }
    const memberFindings = members.map((member) => findings[member])
    groups.push({
      id: `finding-group-${groups.length + 1}`,
      findingIds: memberFindings.map((item, itemIndex) => item.id ?? `finding-${members[itemIndex] + 1}`),
      files: [...new Set(memberFindings.flatMap((item) => list(item.files)))].sort(),
      rootCauses: [...new Set(memberFindings.map((item) => item.rootCause).filter(Boolean))].sort(),
      threatClasses: [...new Set(memberFindings.map((item) => item.threatClass).filter(Boolean))].sort(),
      severity: maxSeverity(memberFindings.map((item) => item.severity).filter((item) => SEVERITIES.includes(item))),
    })
  })

  return groups
}

/**
 * Decide whether a finding blocks, needs fixing, or belongs in backlog.
 *
 * @param {{ severity?: string }} finding
 * @param {{ introduced?: boolean, worsened?: boolean, contractRequires?: boolean, falsePositive?: boolean }} context
 * @returns {"BLOCKING"|"FIX_NOW"|"DEFERRED"|"ACCEPTED_RISK"|"FALSE_POSITIVE"}
 */
export function dispositionFinding(finding = {}, context = {}) {
  if (context.falsePositive) return "FALSE_POSITIVE"
  if (context.contractRequires || (context.introduced && finding.severity === "HIGH") || (context.worsened && finding.severity === "HIGH")) {
    return "BLOCKING"
  }
  if (context.introduced || context.worsened) return "FIX_NOW"
  if (context.introduced === false && context.worsened === false) return "DEFERRED"
  return "ACCEPTED_RISK"
}
