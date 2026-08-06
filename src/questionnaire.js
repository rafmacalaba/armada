// Interactive questionnaire for `armada init`. Zero-dependency: uses node
// readline so the CLI works without installing prompt libs. Also supports
// declarative flags and --from-armada re-scaffold mode. Prompts that are
// single/multi choices delegate to the arrow-key pickers in `./ui.js`, which
// fall back to line-based input when stdin is not a TTY.

import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

import { ROLES, CATALOG, modelFor, fallbackFor } from "./model-catalog.js"
import { detectStack, formatStack } from "./stack-detect.js"
import { select, multiSelect, confirm } from "./ui.js"

export { confirm } from "./ui.js"

export async function ask(question, { default: dflt, validate, input, output } = {}) {
  const rl = createInterface({ input: input ?? stdin, output: output ?? stdout })
  const suffix = dflt ? ` [${dflt}]` : ""
  let answer
  while (true) {
    answer = (await rl.question(`${question}${suffix} `)).trim()
    if (!answer) answer = dflt
    if (!answer) {
      rl.close()
      return answer
    }
    if (validate && !validate(answer)) {
      console.error("  Invalid input, try again.")
      continue
    }
    break
  }
  rl.close()
  return answer
}

// Offer a model choice for one role: primary (recommended) vs fallback vs free.
async function pickModel(role) {
  const e = CATALOG[role]
  const options = [
    { label: `${modelFor(role, "balanced")} (Recommended)`, value: modelFor(role, "balanced"), variant: e.variant },
    { label: `free: ${modelFor(role, "free")}`, value: modelFor(role, "free") },
    { label: `fallback: ${fallbackFor(role)}`, value: fallbackFor(role) },
    { label: `power: ${e.power}`, value: e.power, variant: e.variant },
  ]
  const rl = createInterface({ input: stdin, output: stdout })
  console.log(`\n${role} (${e.label}):`)
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}`))
  const raw = await rl.question(`Pick 1-${options.length} [1] `)
  rl.close()
  const idx = parseInt(raw, 10)
  const choice = Number.isInteger(idx) && idx >= 1 && idx <= options.length ? options[idx - 1] : options[0]
  return { model: choice.value, variant: choice.variant }
}

// Compact review table shown before anything is written.
function renderSummary(out, { name, budget, enabled, overrides, browserTesting }) {
  const W = 60
  const rows = [
    `name:    ${name}`,
    `budget:  ${budget}`,
    `team:    ${enabled.length ? `${enabled.join(", ")} (${enabled.length} roles)` : "none"}`,
    ...enabled.map((role) => `  ${role}: ${overrides[role]?.model ?? modelFor(role, budget)}`),
    `browser: ${browserTesting ? "e2e enabled" : "disabled"}`,
  ]
  out.write(`\n── ${"Summary".padEnd(W - 6, "─")}\n`)
  for (const r of rows) out.write(`${r}\n`)
  out.write(`${"─".repeat(W)}\n`)
}

// Full interactive questionnaire. Returns a manifest object (minus targetDir).
export async function runQuestionnaire(rootDir = ".", { input, output } = {}) {
  const out = output ?? stdout
  const detected = detectStack(rootDir)
  out.write("\n=== armada setup ===\n")
  out.write(`Detected stack: ${formatStack(detected)}\n`)

  const name = await ask("Project name", { default: guessName(rootDir), input, output })

  // Budget tier — arrow-key picker with descriptions, default balanced.
  const budget = await select(
    "Budget tier",
    [
      { label: "free", value: "free", hint: "no-cost opencode models" },
      { label: "balanced", value: "balanced", hint: "free workers, paid reviewers (recommended)" },
      { label: "power", value: "power", hint: "strongest models on every role" },
    ],
    { defaultIndex: 1, input, output },
  )

  // Team roles — one multi-select instead of eight Y/N prompts.
  const enabled = await multiSelect(
    "Team roles",
    ROLES.map((role) => ({ label: `${role} (${CATALOG[role].label})`, value: role })),
    { defaults: ROLES, input, output },
  )

  // Per-role model override (defaults from budget). Ask only for the big four
  // to avoid questionnaire fatigue; others keep catalog defaults.
  const overrides = {}
  for (const role of enabled) {
    if (["orchestrator", "backend-dev", "frontend-dev", "qa", "adversary"].includes(role)) {
      const want = await confirm(`Customize model for ${role}?`, false, { input, output })
      if (want) overrides[role] = await pickModel(role)
    }
  }

  const browserTesting = await confirm("Enable browser/e2e testing (agent-browser + devcontainer)?", true, { input, output })
  const devcontainer = browserTesting ? true : await confirm("Add .devcontainer anyway?", false, { input, output })
  const useAgentBrowser = browserTesting

  // Final review before writing anything.
  renderSummary(out, { name, budget, enabled, overrides, browserTesting })
  const approved = await confirm("Write this configuration?", true, { input, output })
  if (!approved) {
    out.write("Setup cancelled.\n")
    process.exit(1)
  }

  return {
    project: {
      name,
      budget,
      browserTesting,
      devcontainer,
      useAgentBrowser,
      stack: detected,
    },
    team: enabled.map((role) => ({
      role,
      model: overrides[role]?.model ?? modelFor(role, budget),
      variant: overrides[role]?.variant ?? CATALOG[role].variant ?? null,
      enabled: true,
    })),
  }
}

export function guessName(dir) {
  const parts = dir.split("/").filter(Boolean)
  return parts[parts.length - 1] || "my-project"
}

/**
 * Interactive category picker for `armada new`.
 * @param {Array<{id: string, name: string, description: string, dir: string}>} categories
 * @param {{ blank?: boolean, template?: string, input?: any, output?: any }} [opts]
 * @returns {Promise<string|null>} category id, "blank", or null (external template)
 */
export async function pickCategory(categories, opts = {}) {
  if (opts.blank) return "blank"
  if (opts.template) return null

  const inp = opts.input ?? stdin
  const out = opts.output ?? stdout
  if (!inp.isTTY) return "blank"

  const rl = createInterface({ input: inp, output: out })
  out.write("\nProject templates:\n")
  categories.forEach((c, i) => {
    out.write(`  ${i + 1}. ${c.name} — ${c.description}\n`)
  })
  const raw = await rl.question(`Pick 1-${categories.length} [1] `)
  rl.close()

  const trimmed = raw.trim()
  if (!trimmed) return categories[0].id

  // Try numeric index first
  const idx = parseInt(trimmed, 10)
  if (Number.isInteger(idx) && idx >= 1 && idx <= categories.length) {
    return categories[idx - 1].id
  }

  // Try case-insensitive id match
  const lower = trimmed.toLowerCase()
  const match = categories.find((c) => c.id.toLowerCase() === lower)
  if (match) return match.id

  // Fallback to first entry
  return categories[0].id
}
