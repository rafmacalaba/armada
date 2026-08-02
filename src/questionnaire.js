// Interactive questionnaire for `armada init`. Zero-dependency: uses node
// readline so the CLI works without installing prompt libs. Also supports
// declarative flags and --from-armada re-scaffold mode.

import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

import { ROLES, CATALOG, BUDGETS, modelFor, fallbackFor } from "./model-catalog.js"
import { detectStack, formatStack } from "./stack-detect.js"

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

export async function confirm(question, dflt = true, { input, output } = {}) {
  const rl = createInterface({ input: input ?? stdin, output: output ?? stdout })
  const suffix = dflt ? " [Y/n]" : " [y/N]"
  while (true) {
    const answer = (await rl.question(`${question}${suffix} `)).trim().toLowerCase()
    if (!answer) {
      rl.close()
      return dflt
    }
    if (["y", "yes"].includes(answer)) {
      rl.close()
      return true
    }
    if (["n", "no"].includes(answer)) {
      rl.close()
      return false
    }
    console.error("  Please answer y or n.")
  }
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

// Full interactive questionnaire. Returns a manifest object (minus targetDir).
export async function runQuestionnaire(rootDir = ".") {
  const detected = detectStack(rootDir)
  console.log("\n=== opencode-armada setup ===")
  console.log(`Detected stack: ${formatStack(detected)}`)

  const name = await ask("Project name", { default: guessName(rootDir) })

  // Budget tier first — drives default model recommendations.
  const budgetRaw = await ask(`Budget tier (${BUDGETS.join("/")})`, { default: "balanced" })
  const budget = BUDGETS.includes(budgetRaw) ? budgetRaw : "balanced"

  console.log("\nTeam selection (blank = all). Skip a role with 'n'.")
  const enabled = []
  for (const role of ROLES) {
    const keep = await confirm(`Include ${role} (${CATALOG[role].label})?`, true)
    if (keep) enabled.push(role)
  }

  // Per-role model override (defaults from budget). Ask only for the big four
  // to avoid questionnaire fatigue; others keep catalog defaults.
  const overrides = {}
  for (const role of enabled) {
    if (["orchestrator", "backend-dev", "frontend-dev", "qa", "adversary"].includes(role)) {
      const want = await confirm(`Customize model for ${role}?`, false)
      if (want) overrides[role] = await pickModel(role)
    }
  }

  const browserTesting = await confirm("Enable browser/e2e testing (agent-browser + devcontainer)?", true)
  const devcontainer = browserTesting ? true : await confirm("Add .devcontainer anyway?", false)
  const useAgentBrowser = browserTesting

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
