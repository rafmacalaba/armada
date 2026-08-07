// Interactive questionnaire for `armada init`. Zero-dependency: uses node
// readline so the CLI works without installing prompt libs. Also supports
// declarative flags and --from-armada re-scaffold mode. Prompts that are
// single/multi choices delegate to the arrow-key pickers in `./ui.js`, which
// fall back to line-based input when stdin is not a TTY.

import { createInterface } from "node:readline/promises"
import { createInterface as createInterfaceSync } from "node:readline"
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

// Pure parser for a pickModel answer. Returns { model, variant }.
// - empty/whitespace          -> options[defaultIdx] (the recommended default)
// - integer 1-N               -> options[idx-1]
// - integer but out of range  -> options[defaultIdx] (original fallback)
// - non-numeric (parseInt NaN) -> a custom model id: { model: raw, variant: null }
export function parseModelChoice(raw, options, defaultIdx = 0) {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return { model: options[defaultIdx].value, variant: options[defaultIdx].variant }
  const idx = parseInt(trimmed, 10)
  if (Number.isNaN(idx)) {
    // Non-numeric input: treat it as a custom model id typed by the user.
    return { model: trimmed, variant: null }
  }
  if (idx >= 1 && idx <= options.length) {
    return { model: options[idx - 1].value, variant: options[idx - 1].variant }
  }
  // Out-of-range integer: preserve original fallback-to-default behavior.
  return { model: options[defaultIdx].value, variant: options[defaultIdx].variant }
}

// Offer a model choice for one role: primary (recommended) vs fallback vs free.
export async function pickModel(role, { input, output } = {}) {
  const e = CATALOG[role]
  const options = [
    { label: `${modelFor(role, "balanced")} (Recommended)`, value: modelFor(role, "balanced"), variant: e.variant },
    { label: `free: ${modelFor(role, "free")}`, value: modelFor(role, "free") },
    { label: `fallback: ${fallbackFor(role)}`, value: fallbackFor(role) },
    { label: `power: ${e.power}`, value: e.power, variant: e.variant },
  ]
  const rl = createInterface({ input: input ?? stdin, output: output ?? stdout })
  const out = output ?? stdout
  out.write(`\n${role} (${e.label}):\n`)
  options.forEach((o, i) => out.write(`  ${i + 1}. ${o.label}\n`))
  const raw = await rl.question(`Pick 1-${options.length} [1] `)
  rl.close()
  return parseModelChoice(raw, options, 0)
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

  out.write("\nProject templates:\n")
  categories.forEach((c, i) => {
    out.write(`  ${i + 1}. ${c.name} — ${c.description}\n`)
  })

  const rl = createInterfaceSync({ input: inp, output: out })
  let attempts = 0
  const MAX_ATTEMPTS = 3

  return new Promise((resolve) => {
    // DEF-013: handle stdin close — resolve with first entry instead of hanging
    let resolved = false
    const safeResolve = (val) => {
      if (resolved) return
      resolved = true
      try { rl.close() } catch {}
      resolve(val)
    }
    rl.on("close", () => safeResolve(categories[0].id))

    const ask = () => {
      if (attempts >= MAX_ATTEMPTS) {
        return safeResolve(null)
      }
      rl.question(`Pick 1-${categories.length} [1] `, (raw) => {
        attempts++
        const trimmed = raw.trim()
        if (!trimmed) {
          return safeResolve(categories[0].id)
        }

        // Try numeric index first — must be in range
        const idx = parseInt(trimmed, 10)
        if (Number.isInteger(idx)) {
          if (idx >= 1 && idx <= categories.length) {
            return safeResolve(categories[idx - 1].id)
          }
          if (attempts < MAX_ATTEMPTS) {
            out.write(`Invalid choice: ${trimmed}. Pick 1-${categories.length}.\n`)
            return ask()
          }
          out.write(`Invalid choice: ${trimmed}. Giving up after ${MAX_ATTEMPTS} attempts.\n`)
          return safeResolve(null)
        }

        // Try case-insensitive id match
        const lower = trimmed.toLowerCase()
        const match = categories.find((c) => c.id.toLowerCase() === lower)
        if (match) {
          return safeResolve(match.id)
        }

        if (attempts < MAX_ATTEMPTS) {
          out.write(`Unrecognized: "${trimmed}". Pick 1-${categories.length} or a template id.\n`)
          return ask()
        }
        out.write(`Unrecognized: "${trimmed}". Giving up after ${MAX_ATTEMPTS} attempts.\n`)
        safeResolve(null)
      })
    }
    ask()
  })
}
