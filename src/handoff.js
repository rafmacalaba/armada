/**
 * Format a handoff block for dispatched voyages.
 *
 * @param {(string|{voyage: string, session: string})[]} items
 *   - string: voyage name  (session defaults to `voyage-${name}`)
 *   - object: explicit { voyage, session } override
 */
export function formatHandoffBlock(items) {
  if (!items || items.length === 0) return ""

  const entries = items.map((item) => {
    const voyage = typeof item === "string" ? item : item.voyage
    const session = typeof item === "string" ? `voyage-${item}` : item.session
    return { voyage, session }
  })

  const lines = entries.map(
    (e) => `  - ${e.voyage}  (tmux session: ${e.session})  attach: armada voyage attach ${e.session}`
  )

  return `--- HANDOFF ---
Voyages dispatched this turn:
${lines.join("\n")}
Current window: free \u2014 hand off here.
--- END HANDOFF ---`
}
