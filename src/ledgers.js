// Ledger templates for security findings — per-feature security audit records.
// Mirrors adversarial entry format from renderAgentsMd in src/generator.js.
// Provides canonical entry template, per-entry renderer, and default path resolver.

/**
 * Canonical security finding entry template.
 * Format mirrored from adversarial entry in renderAgentsMd (src/generator.js).
 * @param {string} feature - feature name (or "{feature}" token)
 * @returns {string} template markdown
 */
export function securityFindingTemplate(feature) {
  const f = feature || "{feature}"
  return `## SEC-###: Title

- Status: OPEN
- Severity: HIGH | MEDIUM | LOW
- Found by: security
- Phase: N

What I found: ...
Expected: ...
Actual: ...
Screenshot: armada/screenshots/${f}/sec-###.png (optional)

History:
- security: opened`
}

/**
 * Render a single security finding entry.
 * @param {number} num - finding number
 * @param {string} title - short title
 * @param {object} [fields] - {status, severity, foundBy, phase, found, expected, actual, screenshot, history}
 * @returns {string}
 */
export function securityFindingEntry(num, title, fields = {}) {
  const n = String(num).padStart(3, "0")
  const lines = [`## SEC-${n}: ${title}`, ""]
  lines.push(`- Status: ${fields.status ?? "OPEN"}`)
  lines.push(`- Severity: ${fields.severity ?? "MEDIUM"}`)
  lines.push(`- Found by: ${fields.foundBy ?? "security"}`)
  lines.push(`- Phase: ${fields.phase ?? "N"}`)
  lines.push("")
  lines.push(`What I found: ${fields.found ?? "..."}`)
  lines.push(`Expected: ${fields.expected ?? "..."}`)
  lines.push(`Actual: ${fields.actual ?? "..."}`)
  if (fields.screenshot) {
    lines.push(`Screenshot: ${fields.screenshot}`)
  }
  lines.push("")
  lines.push("History:")
  const history = fields.history ?? ["security: opened"]
  for (const h of history) {
    lines.push(`- ${h}`)
  }
  return lines.join("\n")
}

/**
 * Default path for the per-feature security findings ledger.
 * @param {string} feature - feature name
 * @returns {string}
 */
export function defaultSecurityLedgerPath(feature) {
  return `armada/ledgers/${feature}/SECURITY_FINDINGS.md`
}
