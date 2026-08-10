// Pure renderer for init-end summary block.
// Takes a manifest in the shape returned by parseManifestYaml.

const COST_HINTS = {
  free: "Cost:   zero usage cost",
  balanced: "Cost:   free workers, paid reviewers/judges",
  power: "Cost:   strongest models on every role (paid)",
}

export function renderInitSummary(manifest) {
  const { project, team = [] } = manifest
  const enabled = team.filter((t) => t.enabled)
  const budget = project.budget ?? "balanced"

  const lines = [
    `Project: ${project.name}`,
    `Team: ${enabled.length} agents`,
    `Budget: ${budget}`,
    COST_HINTS[budget] ?? COST_HINTS.balanced,
    "Roster:",
  ]

  for (const t of enabled) {
    lines.push(`  ${t.role}: ${t.model}`)
  }

  lines.push(
    "Next steps:",
    "  1. opencode",
    "  2. armada status (CLI)  -> fleet status",
    "  3. 'ping all agents'  -> verify roster",
  )

  const shipnames = project.supervision?.shipnames ?? true
  if (shipnames) {
    lines.push(
      "",
      "+ shipnames plugin (.opencode/plugins/armada-shipnames.js) — TUI task prefix",
    )
  } else {
    lines.push(
      "",
      "shipnames plugin (disabled via --no-shipnames)",
    )
  }

  if (project.openrouterProviders?.length) {
    lines.push(
      `OpenRouter Provider Order: ${project.openrouterProviders.join(", ")}`,
    )
  }

  return lines.join("\n")
}
