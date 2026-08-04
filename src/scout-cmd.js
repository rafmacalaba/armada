/**
 * scout-cmd — prints an investigation brief for a given code area.
 *
 * Takes <area> as first arg. 4-section brief:
 *   ## Area
 *   ## Suggested role (xebec for hostile review, bark for architecture)
 *   ## What to look for (3-5 bullets from area name heuristics)
 *   ## Deliverable
 *
 * @module scout-cmd
 */

// ---- public API ------------------------------------------------------------

/**
 * Generate a 4-section scouting brief.
 * @param {string} area - the area to investigate
 * @returns {string}
 */
export function renderScout(area) {
  const role = _suggestRole(area)
  const bullets = _whatToLookFor(area)

  let out = ""
  out += `## Area\n\n${area}\n\n`
  out += `## Suggested role\n\n${role}\n\n`
  out += `## What to look for\n\n`
  for (const b of bullets) {
    out += `  - ${b}\n`
  }
  out += "\n"
  out += `## Deliverable\n\nFindings report in chat. No writes. No PR.\n`
  return out
}

/**
 * CLI main entry point.
 * @param {string[]} argv - remaining args after "scout"
 * @returns {{ code: number, output: string }}
 */
export function main(argv = []) {
  if (argv.length === 0) {
    return { code: 1, output: "scout: area argument required\n" }
  }

  const area = argv.join(" ")
  return { code: 0, output: renderScout(area) }
}

// ---- internal helpers (exported for tests) ---------------------------------

/**
 * Suggest a role based on area name keywords.
 * @param {string} area
 * @returns {string}
 */
export function _suggestRole(area) {
  const lower = area.toLowerCase()
  if (lower.includes("hostile")) return "xebec"
  if (lower.includes("architect")) return "bark"
  if (lower.includes("architecture")) return "bark"
  return "xebec"
}

/**
 * Generate 3-5 investigation bullets from area name heuristics.
 * @param {string} area
 * @returns {string[]}
 */
export function _whatToLookFor(area) {
  const lower = area.toLowerCase()

  if (lower.includes("test")) {
    return [
      "Test coverage gaps in changed modules",
      "Edge cases missing at boundaries",
      "Mock fidelity vs real implementations",
      "Test isolation (no shared mutable state)",
      "Assertion strength (strict equality, not loose truthiness)",
    ]
  }

  if (lower.includes("auth")) {
    return [
      "Auth middleware bypass paths",
      "Token validation and expiry handling",
      "Role/permission escalation vectors",
      "Session management and cookie security",
      "Error message information leakage",
    ]
  }

  if (lower.includes("perf")) {
    return [
      "Hot path bottlenecks (CPU profiling)",
      "Unnecessary allocations in tight loops",
      "N+1 query patterns",
      "Missing caching on repeated expensive calls",
      "Blocking I/O on async paths",
    ]
  }

  return [
    "Public surface area (exports, API endpoints)",
    "Input validation and error handling",
    "Assumptions about callers or call order",
    "Hidden side effects or global state",
    "Compatibility with existing contracts",
  ]
}
