// Role display-name map — aesthetic layer only.
// The role key is the stable identifier everywhere (plumbing, file names,
// manifest, frontmatter, AGENTS.md roster, tests). This module is the
// single source of truth for human-readable display names on UI surfaces.

export const DISPLAY = Object.freeze({
  orchestrator: "Commodore",
  "backend-dev": "Galleon",
  "frontend-dev": "Clipper",
  qa: "Corvette",
  adversary: "Xebec",
  security: "Frigate",
  docs: "Caravel",
  architect: "Bark",
})

export const ROLES = Object.keys(DISPLAY)

export function displayFor(role) {
  const name = DISPLAY[role]
  if (!name) throw new Error(`Unknown role: ${role}`)
  return name
}
