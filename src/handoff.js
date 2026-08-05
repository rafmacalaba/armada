export function formatHandoffBlock(sessions) {
  if (!sessions || sessions.length === 0) return ""

  const lines = sessions.map(
    (name) => `  - ${name}  (tmux session: ${name})  attach: armada voyage attach ${name}`
  )

  return `--- HANDOFF ---
Voyages dispatched this turn:
${lines.join("\n")}
Current window: free \u2014 hand off here.
--- END HANDOFF ---`
}
